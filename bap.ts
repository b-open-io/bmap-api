import type { BmapTx } from 'bmapjs';
import _ from 'lodash';
import { ObjectId } from 'mongodb';
import { type CacheValue, readFromRedis, saveToRedis } from './cache.js';
import { EXTERNAL_APIS } from './config/constants.js';
import { getBAPDbo } from './db.js';
import { sigmaIdentityToBapIdentity } from './social/queries/identity.js';
import type { SearchParams } from './social/queries/types.js';
import type { BapAddress, BapIdentity } from './types.js';

const { uniqBy } = _;

export interface BapIdentityObject {
  alternateName?: string;
  name?: string;
  description?: string;
  url?: string;
  image?: string;
  [key: string]: unknown;
}

// Database structure for addresses (as stored in MongoDB)
interface DatabaseAddress {
  address?: string;
  txid?: string; // Note: database uses lowercase 'txid'
  block?: number;
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
    signal: AbortSignal.timeout(10_000),
  });
  if (result.status === 404) return undefined;
  if (!result.ok) throw new Error(`Identity API returned HTTP ${result.status}`);
  const data = await result.json();
  const record = data.status === 'OK' ? data.result : data;
  if (!record?.identity?.idKey || !Array.isArray(record.identity.addresses))
    throw new Error('Identity API returned an invalid address lookup');
  return sigmaIdentityToBapIdentity({
    ...record.identity,
    valid: record.validityRecord?.valid === true,
    profile: record.profile ?? record.identity.profile,
  });
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
    addresses: (s.addresses || []).map((addr: DatabaseAddress) => ({
      address: addr.address || '',
      txId: addr.txid, // Use correct field name from database, undefined if missing
      block: addr.block,
    })),
    block: s.block || 0,
    timestamp: s.timestamp || 0,
    valid: s.valid === true, // Only true if explicitly validated
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

  // Filter out invalid ObjectId strings to prevent BSONError
  const validIds = idKeys.filter((id) => {
    try {
      new ObjectId(id);
      return true;
    } catch {
      console.warn(`Invalid ObjectId: ${id}`);
      return false;
    }
  });

  if (validIds.length === 0) {
    return [];
  }

  const identities = await db
    .collection('identities')
    .find(
      { _id: { $in: validIds.map((id) => new ObjectId(id)) } },
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

  // Filter out invalid ObjectId strings to prevent BSONError
  const validIds = idKeys.filter((id) => {
    try {
      new ObjectId(id);
      return true;
    } catch {
      console.warn(`Invalid ObjectId: ${id}`);
      return false;
    }
  });

  if (validIds.length === 0) {
    return [];
  }

  const identities = await db
    .collection('identities')
    .find({ _id: { $in: validIds.map((id) => new ObjectId(id)) } })
    .toArray();

  return identities.map((s) => ({
    idKey: s._id.toString(),
    rootAddress: s.rootAddress,
    currentAddress: s.currentAddress,
    addresses: (s.addresses || []).map((addr: DatabaseAddress) => ({
      address: addr.address || '',
      txId: addr.txid, // Use correct field name from database, undefined if missing
      block: addr.block,
    })),
    block: s.block || 0,
    timestamp: s.timestamp || 0,
    valid: s.valid === true, // Only true if explicitly validated
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

  const addresses = [
    ...new Set(
      txs
        .flatMap((tx) => [...(tx.AIP ?? []), ...(tx.SIGMA ?? [])].map((signer) => signer.address))
        .filter(Boolean)
    ),
  ];
  const identities: BapIdentity[] = [];
  for (let offset = 0; offset < addresses.length; offset += 8) {
    const batch = await Promise.all(addresses.slice(offset, offset + 8).map(resolveSigner));
    identities.push(...batch.filter((identity): identity is BapIdentity => !!identity?.idKey));
  }
  return uniqBy(identities, (identity) => identity.idKey);
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
    addresses: (s.addresses || []).map((addr: DatabaseAddress) => ({
      address: addr.address || '',
      txId: addr.txid, // Use correct field name from database, undefined if missing
      block: addr.block,
    })),
    block: s.block || 0,
    timestamp: s.timestamp || 0,
    valid: s.valid === true, // Only true if explicitly validated
    identityTxId: s.identityTxId || '',
    identity:
      s.profile && typeof s.profile === 'object'
        ? { ...s.profile, '@type': 'Person', firstSeen: s.firstSeen || s.timestamp || 0 }
        : { '@type': 'Person', firstSeen: s.firstSeen || s.timestamp || 0 },
    firstSeen: s.firstSeen || s.timestamp || 0,
  }));
}
