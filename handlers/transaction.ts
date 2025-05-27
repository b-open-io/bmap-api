import type { BmapTx } from 'bmapjs';
import type { Filter } from 'mongodb';
import { type CacheValue, readFromRedis, saveToRedis } from '../cache.js';
import { getDbo } from '../db.js';
import { processTransaction } from '../process.js';
import { bobFromTxid, jsonFromTxid, rawTxFromTxid } from '../utils/transactions.js';

/* Handle different transaction request formats */
export const handleTxRequest = async (txid: string, format?: string) => {
  if (!txid) throw new Error('Missing txid');
  try {
    if (format === 'raw') return rawTxFromTxid(txid);
    if (format === 'json') return jsonFromTxid(txid);
    if (format === 'bob') return bobFromTxid(txid);
    if (format === 'signer') {
      const rawTx = await rawTxFromTxid(txid);
      const { signer } = await processTransaction(rawTx);
      if (!signer) {
        throw new Error('No signer found for transaction');
      }
      return signer;
    }

    const cacheKey = `tx:${txid}`;
    const cached = await readFromRedis<CacheValue>(cacheKey);
    let decoded: BmapTx;

    if (cached?.type === 'tx' && cached.value) {
      console.log('Cache hit for tx:', txid);
      decoded = cached.value;
    } else {
      console.log('Cache miss for tx:', txid);
      const db = await getDbo();
      const collections = ['message', 'like', 'post', 'repost'];
      let dbTx: BmapTx | null = null;
      for (const collection of collections) {
        const result = await db
          .collection<{ _id: string }>(collection)
          .findOne({ _id: txid } as Filter<{ _id: string }>);
        if (result && 'tx' in result && 'out' in result) {
          dbTx = result as unknown as BmapTx;
          console.log('Found tx in MongoDB collection:', collection);
          break;
        }
      }
      if (dbTx) {
        decoded = dbTx;
      } else {
        const rawTx = await rawTxFromTxid(txid);
        const { result, signer } = await processTransaction(rawTx);
        decoded = result;

        const txDetails = await jsonFromTxid(txid);
        if (txDetails.block_height && txDetails.block_time) {
          decoded.blk = {
            i: txDetails.block_height,
            t: txDetails.block_time,
          };
        } else if (txDetails.block_time) {
          decoded.timestamp = txDetails.block_time;
        }
        if (decoded.B || decoded.MAP) {
          try {
            const collection = decoded.MAP?.[0]?.type || 'message';
            await db
              .collection<{ _id: string }>(collection)
              .updateOne(
                { _id: txid } as Filter<{ _id: string }>,
                { $set: decoded },
                { upsert: true }
              );
            console.log('Saved tx to MongoDB collection:', collection);
          } catch (error) {
            console.error('Error saving to MongoDB:', error);
          }
        }
        if (signer) {
          await saveToRedis<CacheValue>(`signer-${signer.idKey}`, {
            type: 'signer',
            value: signer,
          });
        }
      }

      await saveToRedis<CacheValue>(cacheKey, {
        type: 'tx',
        value: decoded,
      });
    }
    if (format === 'file') {
      let vout = 0;
      if (txid.includes('_')) {
        const parts = txid.split('_');
        vout = Number.parseInt(parts[1], 10);
      }
      let dataBuf: Buffer | undefined;
      let contentType: string | undefined;
      if (decoded.ORD?.[vout]) {
        dataBuf = Buffer.from(decoded.ORD[vout]?.data, 'base64');
        contentType = decoded.ORD[vout].contentType;
      } else if (decoded.B?.[vout]) {
        dataBuf = Buffer.from(decoded.B[vout]?.content, 'base64');
        contentType = decoded.B[vout]['content-type'];
      }
      if (dataBuf && contentType) {
        return new Response(dataBuf, {
          headers: {
            'Content-Type': contentType,
            'Content-Length': String(dataBuf.length),
          },
        });
      }
      throw new Error('No data found in transaction outputs');
    }
    switch (format) {
      case 'bmap':
        return decoded;
      default:
        if (format && decoded[format]) {
          return decoded[format];
        }
        return format?.length
          ? `Key ${format} not found in tx`
          : new Response(`<pre>${JSON.stringify(decoded, null, 2)}</pre>`, {
              headers: { 'Content-Type': 'text/html' },
            });
    }
  } catch (error: unknown) {
    console.error('Error processing transaction:', error);
    const errMsg = error instanceof Error ? error.message : String(error);
    let statusCode = 500;
    if (errMsg.includes('Empty response from JB') || errMsg.includes('Failed to fetch raw tx:')) {
      statusCode = 404;
    }
    return new Response(
      JSON.stringify({
        error: errMsg,
        stack: error instanceof Error ? error.stack : undefined,
      }),
      {
        status: statusCode,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};