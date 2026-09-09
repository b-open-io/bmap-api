import type { ChangeStreamDocument, Document } from 'mongodb';

type Cursor = { tryNext(): Promise<ChangeStreamDocument<Document> | null>; close(): Promise<void> };
let activeStreams = 0;
const MAX_STREAMS = 32;
const encoder = new TextEncoder();

export function streamChanges(createCursor: () => Cursor, signal: AbortSignal): Response {
  if (activeStreams >= MAX_STREAMS)
    return new Response('Too many subscriptions', { status: 503, headers: { 'Retry-After': '5' } });
  const cursor = createCursor();
  activeStreams++;
  let closed = false;
  let initial = true;
  const close = async () => {
    if (closed) return;
    closed = true;
    activeStreams--;
    signal.removeEventListener('abort', abort);
    await cursor.close();
  };
  const abort = () => {
    void close().catch(() => {});
  };
  signal.addEventListener('abort', abort, { once: true });
  if (signal.aborted) abort();
  const body = new ReadableStream<Uint8Array>(
    {
      async pull(controller) {
        if (closed) {
          controller.close();
          return;
        }
        try {
          if (initial) {
            initial = false;
            controller.enqueue(encoder.encode('data: {"type":"open","data":[]}\n\n'));
            return;
          }
          const next = await cursor.tryNext();
          if (closed) {
            controller.close();
            return;
          }
          const data =
            next?.operationType === 'insert'
              ? `data: ${JSON.stringify({ type: next.fullDocument?.MAP?.[0]?.type || next.ns.coll, data: [next.fullDocument] })}\n\n`
              : ':heartbeat\n\n';
          const bytes = encoder.encode(data);
          if (bytes.byteLength > 1024 * 1024)
            throw new Error('Stream event exceeds 1 MiB; reconnect and query the transaction');
          controller.enqueue(bytes);
        } catch (error) {
          await close();
          controller.error(error);
        }
      },
      cancel: close,
    },
    { highWaterMark: 0 }
  );
  return new Response(body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no',
    },
  });
}
