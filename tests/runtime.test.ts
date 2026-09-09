import { expect, test } from 'bun:test';
import { EventEmitter } from 'node:events';
import type { ChangeStream } from 'mongodb';
import { closeMessageStream, openMessageStream } from '../social/streams.js';
import { collectQuery, parseQuery } from '../utils/query.js';
import { streamChanges } from '../utils/streams.js';

const encoded = (q: unknown) => Buffer.from(JSON.stringify({ q })).toString('base64');

test('public query caps apply to aggregate and find, including nested write operators', async () => {
  expect(parseQuery('post', encoded({ find: {}, limit: 2, skip: 3 })).skip).toBe(3);
  expect(parseQuery('post', encoded({ aggregate: [{ $match: {} }] })).aggregate?.at(-1)).toEqual({
    $limit: 100,
  });
  for (const q of [
    { limit: 0 },
    { limit: 101 },
    { skip: -1 },
    { aggregate: [{ $out: 'post' }] },
    { aggregate: [{ $lookup: { from: 'post', pipeline: [{ $merge: 'post' }], as: 'p' } }] },
    { find: { $where: 'true' } },
  ])
    expect(() => parseQuery('post', encoded(q))).toThrow();
  let closed = false;
  const cursor = {
    async *[Symbol.asyncIterator]() {
      for (let i = 0; i < 101; i++) yield { i };
    },
    async close() {
      closed = true;
    },
  };
  await expect(collectQuery(cursor)).rejects.toThrow('100 records');
  expect(closed).toBe(true);
  closed = false;
  const oversized = {
    ...cursor,
    async *[Symbol.asyncIterator]() {
      yield { content: 'x'.repeat(4 * 1024 * 1024) };
    },
  };
  await expect(collectQuery(oversized)).rejects.toThrow('4 MiB');
  expect(closed).toBe(true);
});

test('SSE pulls only on demand and closes its cursor on cancel or abort', async () => {
  let reads = 0,
    closes = 0;
  const cursor = {
    async tryNext() {
      reads++;
      return null;
    },
    async close() {
      closes++;
    },
  };
  const abort = new AbortController();
  const response = streamChanges(() => cursor, abort.signal);
  expect(reads).toBe(0);
  const reader = response.body!.getReader();
  await reader.read();
  expect(reads).toBe(0);
  await reader.read();
  expect(reads).toBe(1);
  await reader.cancel();
  abort.abort();
  expect(closes).toBe(1);
  const abort2 = new AbortController();
  const response2 = streamChanges(() => cursor, abort2.signal);
  abort2.abort();
  await response2.body!.cancel();
  expect(closes).toBe(2);
});

test('WebSocket disconnect closes an existing cursor and a cursor still being created', async () => {
  let closes = 0;
  const cursor = Object.assign(new EventEmitter(), {
    async close() {
      closes++;
    },
  }) as unknown as ChangeStream;
  const ws = {
    id: 'test',
    close() {},
    send() {
      return 1;
    },
  };
  await openMessageStream(
    ws,
    async () => cursor,
    () => ({ tx: 'test' })
  );
  await closeMessageStream(ws);
  expect(closes).toBe(1);
  let resolve!: (c: ChangeStream) => void;
  const pending = openMessageStream(
    ws,
    () =>
      new Promise((r) => {
        resolve = r;
      }),
    () => ({})
  );
  await closeMessageStream(ws);
  resolve(cursor);
  await pending;
  expect(closes).toBe(2);
});
