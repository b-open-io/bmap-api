import bmapjs, { type AIP, type BmapTx, type BobTx } from 'bmapjs';
import { parse } from 'bpu-ts';
import chalk from 'chalk';
import { getBAPIdByAddress } from './bap.js';
import type { BapIdentity } from './bap.js';
import { getDbo } from './db.js';

const { allProtocols, TransformTx } = bmapjs;

export const processTransaction = async (
  rawTx: string
): Promise<{ result: BmapTx; signer: BapIdentity | null } | null> => {
  try {
    console.log('Starting transaction processing...');
    console.log('Raw transaction:', rawTx);

    if (!rawTx) {
      console.error('No transaction data provided');
      return null;
    }

    console.log('Parsing transaction with bpu-ts...');
    const bob = await parse({
      tx: { r: rawTx },
      split: [{ token: { op: 106 }, include: 'l' }, { token: { s: '|' } }],
    });

    if (!bob) {
      console.error('Failed to parse transaction with bpu-ts');
      return null;
    }

    console.log('BOB parse result:', JSON.stringify(bob, null, 2));

    console.log(
      'Transforming transaction with bmapjs...',
      allProtocols.map((p) => p.name)
    );
    const tx = await TransformTx(
      bob as BobTx,
      allProtocols.map((p) => p.name)
    );

    if (!tx) {
      console.error('Failed to transform transaction with bmapjs');
      return null;
    }

    console.log('Available protocols after transform:', Object.keys(tx || {}));
    if (tx?.B) {
      console.log('B protocol data:', JSON.stringify(tx.B, null, 2));
    }

    console.log('Transformed transaction:', JSON.stringify(tx, null, 2));

    // Get BAP ID if available
    const t = tx as BmapTx;
    let bapId: BapIdentity | undefined;
    console.log('Checking for AIP data...');

    if (t.AIP && Array.isArray(t.AIP) && t.AIP.length > 0) {
      const aip = {
        address: t.AIP[0].address,
        signature: t.AIP[0].signature,
      } as AIP;

      console.log('Found AIP data:', aip);
      if (aip.address) {
        console.log('Getting BAP ID for address:', aip.address);
        bapId = await getBAPIdByAddress(aip.address);
      }
      // biome-ignore lint/performance/noDelete: <explanation>
      delete aip.data;
      tx.AIP[0] = aip;
    }

    // if (bapId) {
    //   console.log('Found BAP ID:', bapId.idKey);
    //   // t.bapId = bapId;
    // }

    // Transform B.Data to B.content for consistency
    if (t.B && Array.isArray(t.B)) {
      t.B = t.B.map((b: any) => {
        if (b.Data) {
          // Convert Data structure to content
          const content = b.Data.utf8 || b.Data.base64 || b.content || '';
          const encoding = b.Data.utf8 ? 'utf-8' : b.Data.base64 ? 'base64' : b.encoding || '';

          return {
            encoding: encoding,
            content: content,
            'content-type': b['content-type'] || 'text/plain',
          };
        }
        // Already in correct format
        return {
          encoding: b.encoding || '',
          content: b.content || '',
          'content-type': b['content-type'] || 'text/plain',
        };
      });
    }

    // Save
    // Add timestamp for unconfirmed transactions
    if (!t.blk?.t || t.blk?.t === 0) {
      console.log('no block time, setting timestamp to now');
      t.timestamp = Math.floor(Date.now() / 1000);
    }

    // Save to collection based on MAP.type
    const dbo = await getDbo();
    const mapType = t.MAP?.[0]?.type;
    if (mapType) {
      console.log('Saving to collection based on MAP.type:', mapType);
      await dbo.collection(mapType).updateOne({ _id: t.tx.h }, { $set: t }, { upsert: true });
      console.log(chalk.green(t.tx.h));
    }

    console.log('Transaction processing completed successfully');
    return {
      result: t,
      signer: bapId,
    };
  } catch (error) {
    console.error('Error in processTransaction:', error);
    throw error;
  }
};
