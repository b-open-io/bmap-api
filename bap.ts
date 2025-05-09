import type { BmapTx } from 'bmapjs';
import _ from 'lodash';
import { type CacheValue, readFromRedis, saveToRedis } from './cache.js';
import { getBAPDbo } from './db.js';
import { SearchParams } from './social/queries/types.js';
const { uniq, uniqBy } = _;

interface BapAddress {
  address: string;
  txId: string;
  block?: number;
}

export interface BapIdentityObject {
  alternateName?: string;
  name?: string;
  description?: string;
  url?: string;
  image?: string;
  [key: string]: unknown;
}

export type BapIdentity = {
  rootAddress: string;
  currentAddress: string;
  addresses: BapAddress[];
  identity: string | BapIdentityObject;
  identityTxId: string;
  idKey: string;
  block: number;
  timestamp: number;
  valid: boolean;
  paymail?: string;
  displayName?: string;
  icon?: string;
};

const bapApiUrl = 'https://api.sigmaidentity.com/api/v1/';

type Payload = {
  address: string;
  block?: number;
  timestamp?: number;
};

export const getBAPIdByAddress = async (
  address: string,
  block?: number,
  timestamp?: number
): Promise<BapIdentity | undefined> => {
  try {
    const payload: Payload = {
      address,
    };
    if (block) {
      payload.block = block;
    }
    if (timestamp) {
      payload.timestamp = timestamp;
    }
    console.log('payload', payload);
    const result = await fetch(`${bapApiUrl}identity/validByAddress`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    const data = await result.json();
    console.log('identity data', { data });
    if (data && data.status === 'OK' && data.result) {
      try {
        return data.result.identity;
      } catch (e) {
        console.log('Failed to parse BAP identity', e, data.result);
      }
    }
    return undefined;
  } catch (e) {
    console.log(e);
    throw e;
  }
};

export const getSigners = async (addresses: string[]) => {
  try {
    const db = await getBAPDbo();
    const identities = await db.collection("identities")
      .find({ "addresses.address": { $in: addresses } })
      .toArray()

    console.log({ addresses, identitiels: identities });
    return identities.map((s) => ({
      idKey: s._id.toString(),
      rootAddress: s.rootAddress,
      currentAddress: s.currentAddress,
      addresses: s.addresses,
      block: s.block || 0,
      timestamp: s.timestamp || 0,
      valid: s.valid,
      identityTxId: s.identityTxId || '',
      identity: s.profile,
    }))
  } catch (e) {
    console.log(e);
    throw e;
  }
};

export const getBAPAddresses = async (idKeys: string[]) => {
  try {
    const db = await getBAPDbo();
    const identities = await db.collection("identities")
      .find({ _id: { $in: idKeys } } as any, { projection: { addresses: { address: 1 } } })
      .toArray()

    console.log({ idKeys, identitiels: identities });

    const addresses = new Set<string>();
    for (const identity of identities) {
      for (const address of identity.addresses) {
        if (address.address) {
          addresses.add(address.address);
        }
      }
    }
    return Array.from(addresses);
  } catch (e) {
    console.log(e);
    throw e;
  }
}

export const getBAPIdentites = async (idKeys: string[]) => {
  try {
    const db = await getBAPDbo();
    const identities = await db.collection("identities")
      .find({ _id: { $in: idKeys } } as any)
      .toArray()

    console.log({ idKeys, identitiels: identities });
    return identities.map((s) => ({
      idKey: s._id.toString(),
      rootAddress: s.rootAddress,
      currentAddress: s.currentAddress,
      addresses: s.addresses,
      block: s.block || 0,
      timestamp: s.timestamp || 0,
      valid: s.valid,
      identityTxId: s.identityTxId || '',
      identity: s.profile,
    }))
  } catch (e) {
    console.log(e);
    throw e;
  }
}

// This function takes an array of transactions and resolves their signers from AIP and SIGMA
export const resolveSigners = async (txs: BmapTx[]) => {
  // Helper function to resolve a signer from cache or fetch if not present
  const resolveSigner = async (address: string): Promise<BapIdentity | undefined> => {
    const cacheKey = `signer-${address}`;
    let cacheValue = await readFromRedis(cacheKey);
    let identity = {};
    if (!cacheValue || (cacheValue && 'error' in cacheValue && cacheValue.error === 404)) {
      // If not found in cache, look it up and save
      try {
        identity = await getBAPIdByAddress(address);
        if (identity) {
          cacheValue = { type: 'signer', value: identity } as CacheValue;
          await saveToRedis<CacheValue>(cacheKey, cacheValue);
          console.log('BAP saved to cache:', identity);
        } else {
          console.log('No BAP found for address:', address);
        }
      } catch (e) {
        console.log('Failed to get BAP ID by Address:', e);
      }
    } else {
      console.log('BAP already in cache for address:', address);
    }
    return cacheValue ? (cacheValue.value as BapIdentity | undefined) : null;
  };

  // Function to process signers for a single transaction
  const processSigners = async (tx: BmapTx) => {
    const signerAddresses = [...(tx.AIP || []), ...(tx.SIGMA || [])].map(
      (signer) => signer.address
    );
    const uniqueAddresses = uniq(signerAddresses.filter((a) => !!a));
    const signerPromises = uniqueAddresses.map((address) => resolveSigner(address));
    const resolvedSigners = await Promise.all(signerPromises);
    return resolvedSigners.filter((signer) => signer !== null);
  };

  // Process all transactions and flatten the list of signers

  const signerLists = await Promise.all(
    txs
      .filter((t) => !!t.AIP || !!t.SIGMA)
      .sort((a, b) => (a.blk?.t > b.blk?.t ? -1 : 1))
      .map((tx) => processSigners(tx))
  );
  return uniqBy(signerLists.flat(), (b) => b.idKey);
};

export async function searchIdentities({ q, limit = 10, offset = 3 }: SearchParams): Promise<BapIdentity[]> {
  try {
    const db = await getBAPDbo();
    const pipeline = [
      { $search: { index: 'default', text: { query: q, path: { wildcard: '*' } } } },
      { $skip: offset },
      { $limit: limit },
    ]
    const identities = await db.collection("identities").aggregate(pipeline).toArray();

    return identities.map((s) => ({
      idKey: s._id.toString(),
      rootAddress: s.rootAddress,
      currentAddress: s.currentAddress,
      addresses: s.addresses,
      block: s.block || 0,
      timestamp: s.timestamp || 0,
      valid: s.valid,
      identityTxId: s.identityTxId || '',
      identity: s.profile,
    }))
  } catch (e) {
    console.log(e);
    throw e;
  }
}