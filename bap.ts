import type { BmapTx } from 'bmapjs';
import _ from 'lodash';
import { ObjectId } from 'mongodb';
import { type CacheValue, readFromRedis, saveToRedis } from './cache.js';
import { EXTERNAL_APIS } from './config/constants.js';
import { getBAPDbo } from './db.js';
import type { SearchParams } from './social/queries/types.js';
import type { BapAddress, BapIdentity } from './types.js';
const { uniq, uniqBy } = _;

export interface BapIdentityObject {
  alternateName?: string;
  name?: string;
  description?: string;
  url?: string;
  image?: string;
  [key: string]: unknown;
}

const bapApiUrl = EXTERNAL_APIS.BAP;

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
  const payload: Payload = {
    address,
  };
  if (block) {
    payload.block = block;
  }
  if (timestamp) {
    payload.timestamp = timestamp;
  }
  const result = await fetch(`${bapApiUrl}identity/validByAddress`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const data = await result.json();
  if (data && data.status === 'OK' && data.result) {
    return data.result.identity;
  }
  return undefined;
};

export const getSigners = async (addresses: string[]) => {
  const db = await getBAPDbo();
  const identities = await db
    .collection('identities')
    .find({ 'addresses.address': { $in: addresses } })
    .toArray();

  return identities.map((s) => ({
    idKey: s._id.toString(),
    rootAddress: s.rootAddress,
    currentAddress: s.currentAddress,
    addresses: s.addresses,
    block: s.block || 0,
    timestamp: s.timestamp || 0,
    valid: s.valid,
    identityTxId: s.identityTxId || '',
    identity:
      s.profile && typeof s.profile === 'object'
        ? { ...s.profile, '@type': 'Person', firstSeen: s.firstSeen || s.timestamp || 0 }
        : { '@type': 'Person', firstSeen: s.firstSeen || s.timestamp || 0 },
    firstSeen: s.firstSeen || s.timestamp || 0,
  }));
};

export const getBAPAddresses = async (idKeys: string[]) => {
  const db = await getBAPDbo();
  const identities = await db
    .collection('identities')
    .find(
      { _id: { $in: idKeys.map((id) => new ObjectId(id)) } },
      { projection: { addresses: { address: 1 } } }
    )
    .toArray();

  const addresses = new Set<string>();
  for (const identity of identities) {
    for (const address of identity.addresses) {
      if (address.address) {
        addresses.add(address.address);
      }
    }
  }
  return Array.from(addresses);
};

export const getBAPIdentites = async (idKeys: string[]) => {
  const db = await getBAPDbo();
  const identities = await db
    .collection('identities')
    .find({ _id: { $in: idKeys.map((id) => new ObjectId(id)) } })
    .toArray();

  return identities.map((s) => ({
    idKey: s._id.toString(),
    rootAddress: s.rootAddress,
    currentAddress: s.currentAddress,
    addresses: s.addresses,
    block: s.block || 0,
    timestamp: s.timestamp || 0,
    valid: s.valid,
    identityTxId: s.identityTxId || '',
    identity:
      s.profile && typeof s.profile === 'object'
        ? { ...s.profile, '@type': 'Person', firstSeen: s.firstSeen || s.timestamp || 0 }
        : { '@type': 'Person', firstSeen: s.firstSeen || s.timestamp || 0 },
    firstSeen: s.firstSeen || s.timestamp || 0,
  }));
};

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
        } else {
        }
      } catch (_e) {}
    } else {
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

export async function searchIdentities({
  q,
  limit = 10,
  offset = 3,
}: SearchParams): Promise<BapIdentity[]> {
  const db = await getBAPDbo();
  const pipeline = [
    { $search: { index: 'default', text: { query: q, path: { wildcard: '*' } } } },
    { $skip: offset },
    { $limit: limit },
  ];
  const identities = await db.collection('identities').aggregate(pipeline).toArray();

  return identities.map((s) => ({
    idKey: s._id.toString(),
    rootAddress: s.rootAddress,
    currentAddress: s.currentAddress,
    addresses: s.addresses,
    block: s.block || 0,
    timestamp: s.timestamp || 0,
    valid: s.valid,
    identityTxId: s.identityTxId || '',
    identity:
      s.profile && typeof s.profile === 'object'
        ? { ...s.profile, '@type': 'Person', firstSeen: s.firstSeen || s.timestamp || 0 }
        : { '@type': 'Person', firstSeen: s.firstSeen || s.timestamp || 0 },
    firstSeen: s.firstSeen || s.timestamp || 0,
  }));
}
