import type { Transaction } from '@gorillapool/js-junglebus';
import bmapjs, { type BmapTx, type BobTx } from 'bmapjs';
import { parse } from 'bpu-ts';
import { getDbo } from './db.js';
import { normalize } from './bmap.js';
import { getBAPIdByAddress } from './bap.js';
import type { BapIdentity } from './bap.js';
import type { TransformedTx } from './types.js';
import chalk from 'chalk';

const { allProtocols, TransformTx } = bmapjs;

export const processTransaction = async (data: Partial<Transaction>): Promise<BmapTx | null> => {
  try {
    console.log('Starting transaction processing...');
    console.log('Raw transaction:', data.transaction);

    if (!data.transaction) {
      console.error('No transaction data provided');
      return null;
    }

    console.log('Parsing transaction with bpu-ts...');
    const bob = await parse({
      tx: { r: data.transaction },
      split: [{ token: { op: 106 }, include: 'l' }, { token: { s: '|' } }],
    });

    if (!bob) {
      console.error('Failed to parse transaction with bpu-ts');
      return null;
    }

    console.log('Parsed BOB:', JSON.stringify(bob, null, 2));

    console.log('Transforming transaction with bmapjs...', allProtocols.map((p) => p.name));
    const tx = await TransformTx(
      bob as BobTx,
      allProtocols.map((p) => p.name)
    );

    if (!tx) {
      console.error('Failed to transform transaction with bmapjs');
      return null;
    }

    console.log('Transformed transaction:', JSON.stringify(tx, null, 2));

    // Get BAP ID if available
    const t = tx as TransformedTx;
    let bapId: BapIdentity | undefined;
    console.log('Checking for AIP data...');

    if (t.AIP && Array.isArray(t.AIP) && t.AIP.length > 0) {
      const aip = t.AIP[0];
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
    }

    if (bapId) {
      console.log('Found BAP ID:', bapId.idKey);
      t.bapId = bapId;
    }

    // Normalize and save
    const normalizedTx = normalize(t);
    console.log('Normalized transaction:', JSON.stringify(normalizedTx, null, 2));

    // Save to collection based on MAP.type
    const dbo = await getDbo();
    const mapType = normalizedTx.MAP?.[0]?.type;
    if (mapType) {
      console.log('Saving to collection based on MAP.type:', mapType);
      await dbo.collection(mapType).updateOne(
        { 'tx.h': normalizedTx.tx.h },
        { $set: normalizedTx },
        { upsert: true }
      );
      console.log(chalk.green(normalizedTx.tx.h));
    }

    console.log('Transaction processing completed successfully');
    return normalizedTx;
  } catch (error) {
    console.error('Error in processTransaction:', error);
    throw error;
  }
};
