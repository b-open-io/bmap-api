import bmapjs, { type AIP, type BmapTx, type BobTx } from 'bmapjs';
import { parse } from 'bpu-ts';
import chalk from 'chalk';
import { getBAPIdByAddress } from './bap.js';
import type { BapIdentity } from './bap.js';
import { normalize, unNormalize } from './bmap.js';
import { getDbo } from './db.js';
import type { TransformedTx } from './types.js';

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
    const t = tx as TransformedTx;
    let bapId: BapIdentity | undefined;
    console.log('Checking for AIP data...');

    if (t.AIP && Array.isArray(t.AIP) && t.AIP.length > 0) {
      const aip = {
        algorithm_signing_component: t.AIP[0].algorithm_signing_component,
        address: t.AIP[0].address,
        signature: t.AIP[0].signature,
      } as AIP;

      console.log('Found AIP data:', aip);
      if (aip.algorithm_signing_component) {
        console.log(
          'Getting BAP ID for algorithm_signing_component:',
          aip.algorithm_signing_component
        );
        bapId = await getBAPIdByAddress(aip.algorithm_signing_component);
      } else if (aip.address) {
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

    // Normalize and save
    const normalizedTx = normalize(t);
    console.log('Normalized transaction:', JSON.stringify(normalizedTx, null, 2));

    const unnormalizedTx = unNormalize(normalizedTx);

    console.log('Unnormalized transaction:', JSON.stringify(unnormalizedTx, null, 2));

    // Add timestamp for unconfirmed transactions
    if (!unnormalizedTx.blk?.t || unnormalizedTx.blk?.t === 0) {
      console.log('no block time, setting timestamp to now');
      unnormalizedTx.timestamp = Math.floor(Date.now() / 1000);
    }

    // Save to collection based on MAP.type
    const dbo = await getDbo();
    const mapType = unnormalizedTx.MAP?.[0]?.type;
    if (mapType) {
      console.log('Saving to collection based on MAP.type:', mapType);
      await dbo
        .collection(mapType)
        .updateOne({ _id: unnormalizedTx.tx.h }, { $set: unnormalizedTx }, { upsert: true });
      console.log(chalk.green(unnormalizedTx.tx.h));
    }

    console.log('Transaction processing completed successfully');
    return {
      result: unnormalizedTx,
      signer: bapId,
    };
  } catch (error) {
    console.error('Error in processTransaction:', error);
    throw error;
  }
};
