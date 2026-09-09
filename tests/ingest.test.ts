import { expect, test } from 'bun:test';
import { Elysia } from 'elysia';
import { transactionRoutes } from '../routes/transaction.js';

test('social ingest forwards exact transaction bytes to the social overlay', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async (url, init) => {
    calls++;
    expect(String(url)).toBe('https://api.sigmaidentity.com/v1/ingest');
    expect(init?.headers).toEqual({ 'Content-Type': 'application/octet-stream' });
    expect(Buffer.from(init?.body as Uint8Array).toString('hex')).toBe('00ff80');
    return Response.json({ status: 'OK', result: { txid: 'test' } });
  }) as typeof fetch;
  try {
    const app = new Elysia().use(transactionRoutes);
    const response = await app.handle(
      new Request('http://localhost/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawTx: '00ff80' }),
      })
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'OK', result: { txid: 'test' } });
    const invalid = await app.handle(
      new Request('http://localhost/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawTx: 'fff' }),
      })
    );
    expect(invalid.status).toBe(422);
    expect(calls).toBe(1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
