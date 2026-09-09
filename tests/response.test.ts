import { expect, test } from 'bun:test';
import { Elysia, t } from 'elysia';
import { BmapTxSchema, SignerSchema } from '../schemas/core.js';

test('response normalization preserves collection results and binary MAP extensions', async () => {
  const record = {
    tx: { h: 'a'.repeat(64) },
    MAP: [{ app: 'test', type: 'message', msg: { b: '/4AA' }, custom: 'kept' }],
    SIGMA: [{ address: 'example' }],
  };
  const app = new Elysia({ normalize: false })
    .get('/query', () => ({ message: [record], signers: [] }), {
      response: t.Object({ signers: t.Array(SignerSchema) }, { additionalProperties: true }),
    })
    .get('/post', () => record, { response: BmapTxSchema });
  const query = await app.handle(new Request('http://localhost/query'));
  expect(query.status).toBe(200);
  expect(await query.json()).toEqual({ message: [record], signers: [] });
  const post = await app.handle(new Request('http://localhost/post'));
  expect(post.status).toBe(200);
  expect(await post.json()).toEqual(record);
});
