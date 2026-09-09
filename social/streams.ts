import type { ChangeStream, ChangeStreamDocument, Document } from 'mongodb';

type Socket = {
  id: string;
  close(code?: number, reason?: string): unknown;
  send(data: string | object): unknown;
};
const subscriptions = new Map<string, { cursor?: ChangeStream }>();

export async function closeMessageStream(ws: Pick<Socket, 'id'>) {
  const entry = subscriptions.get(ws.id);
  subscriptions.delete(ws.id);
  await entry?.cursor?.close();
}

export async function openMessageStream(
  ws: Socket,
  createCursor: () => Promise<ChangeStream>,
  format: (change: ChangeStreamDocument<Document>) => string | object
) {
  if (subscriptions.size >= 32) {
    ws.close(1013, 'Too many subscriptions');
    return;
  }
  const entry: { cursor?: ChangeStream } = {};
  subscriptions.set(ws.id, entry);
  try {
    const cursor = await createCursor();
    if (subscriptions.get(ws.id) !== entry) {
      await cursor.close();
      return;
    }
    entry.cursor = cursor;
    cursor.on('change', (change) => {
      // Bun returns -1 when it is buffering a backpressured WebSocket send.
      if (ws.send(format(change)) === -1) {
        ws.close(1013, 'Slow consumer; reconnect');
        void closeMessageStream(ws).catch(() => {});
      }
    });
    cursor.on('error', () => {
      ws.close(1011, 'Subscription failed');
      void closeMessageStream(ws).catch(() => {});
    });
  } catch {
    await closeMessageStream(ws);
    ws.close(1011, 'Subscription failed');
  }
}
