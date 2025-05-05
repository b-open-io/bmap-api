import type { BapIdentity } from '../../bap.js';
import { getBAPIdByAddress } from '../../bap.js';
import type { CacheValue } from '../../cache.js';
import { readFromRedis, saveToRedis } from '../../cache.js';
import { getDbo } from '../../db.js';
import { PostsResponse } from '../../queries/posts.js';
import type { LikesParams, Reaction } from '../swagger/likes.js';
import { fetchBapIdentityData, validateSignerData } from './identity.js';

// Helper to process likes with better error handling and logging
export async function processLikes(
  likes: Reaction[]
): Promise<{ signerIds: string[]; signers: BapIdentity[] }> {
  console.log('Processing likes:', likes.length);

  // Get unique signer addresses with validation
  const signerAddresses = new Set<string>();
  const invalidLikes: string[] = [];

  for (const like of likes) {
    if (!Array.isArray(like.AIP)) {
      console.warn('Invalid like document - missing AIP array:', like.tx?.h);
      invalidLikes.push(like.tx?.h);
      continue;
    }

    for (const aip of like.AIP) {
      if (!aip.address) {
        console.warn('Invalid AIP entry - missing address:', like.tx?.h);
        continue;
      }
      signerAddresses.add(aip.address);
    }
  }

  if (invalidLikes.length > 0) {
    console.warn('Found invalid like documents:', invalidLikes);
  }

  console.log('Found unique signer addresses:', signerAddresses.size);

  // Fetch and validate signer identities
  const signerIds = Array.from(signerAddresses);
  const signerResults = await Promise.all(
    signerIds.map(async (address) => {
      const signerCacheKey = `signer-${address}`;
      const cachedSigner = await readFromRedis<CacheValue>(signerCacheKey);

      if (cachedSigner?.type === 'signer' && cachedSigner.value) {
        const validation = validateSignerData(cachedSigner.value);
        if (!validation.isValid) {
          console.warn(
            'Invalid cached signer data for address:',
            address,
            'Errors:',
            validation.errors
          );
          return null;
        }
        return cachedSigner.value;
      }

      try {
        const identity = await getBAPIdByAddress(address);
        if (identity) {
          const validation = validateSignerData(identity);
          if (!validation.isValid) {
            console.warn(
              'Invalid fetched signer data for address:',
              address,
              'Errors:',
              validation.errors
            );
            return null;
          }

          await saveToRedis<CacheValue>(signerCacheKey, {
            type: 'signer',
            value: identity,
          });
          return identity;
        }
      } catch (error) {
        console.error(`Failed to fetch identity for address ${address}:`, error);
      }
      return null;
    })
  );

  const validSigners = signerResults.filter((s): s is BapIdentity => s !== null);
  console.log('Successfully processed signers:', validSigners.length);

  return {
    signerIds: validSigners.map((s) => s.idKey),
    signers: validSigners,
  };
}

// export async function getLikes(request: LikeRequest): Promise<LikeInfo[]> {
//   if (!request.txids && !request.messageIds) {
//     throw new Error('Must provide either txids or messageIds');
//   }

//   const db = await getDbo();
//   const results: LikeInfo[] = [];

//   if (request.txids) {
//     for (const txid of request.txids) {
//       const likes = (await db
//         .collection('like')
//         .find({
//           'MAP.type': 'like',
//           'MAP.tx': txid,
//         })
//         .toArray()) as unknown as Reaction[];

//       const { signers } = await processLikes(likes);

//       results.push({
//         txid,
//         likes,
//         total: likes.length,
//         signers,
//       });
//     }
//   }

//   if (request.messageIds) {
//     for (const messageId of request.messageIds) {
//       const likes = (await db
//         .collection('like')
//         .find({
//           'MAP.type': 'like',
//           'MAP.messageID': messageId,
//         })
//         .toArray()) as unknown as Reaction[];

//       const { signers } = await processLikes(likes);

//       results.push({
//         txid: messageId,
//         likes,
//         total: likes.length,
//         signers,
//       });
//     }
//   }

//   return results;
// }

export async function getLikes({
  txid,
  bapId,
  page = 1,
  limit = 100,
}: LikesParams): Promise<PostsResponse> {
  const dbo = await getDbo();
  const skip = (page - 1) * limit;

  const query: {
    "MAP.type"?: string | undefined,
    "AIP.address"?: string | undefined,
  } = {}
  if (txid) {
    query['MAP.tx'] = txid;
  } else if (bapId) {
    const identity = await fetchBapIdentityData(bapId);
    if (!identity?.currentAddress) {
      console.log('No current address found for BAP ID:', bapId, identity);
      throw new Error('Invalid BAP identity data');
    }
    query['AIP.address'] = identity.currentAddress;
  }

  console.log('Querying posts with params:', query, 'page:', page, 'limit:', limit);
  const [results, count] = await Promise.all([
    dbo.collection('like')
      .find(query)
      .sort({ 'timestamp': -1 })
      .skip(skip)
      .limit(limit)
      .toArray(),
    dbo.collection('like').countDocuments(query),
  ]);

  // Get unique signer addresses
  const signerAddresses = new Set<string>();
  for (const msg of results) {
    if (!msg.AIP) continue;
    for (const aip of msg.AIP) {
      if (aip.address) {
        signerAddresses.add(aip.address);
      }
    }
  }

  // Get BAP identities for all signers
  const signers = await Promise.all(
    Array.from(signerAddresses).map((address) => getBAPIdByAddress(address))
  );

  console.log('Results:', results)
  return {
    page,
    limit,
    count,
    results: results.map((msg) => ({
      ...msg,
      tx: { h: msg.tx?.h || '' },
      blk: msg.blk || { i: 0, t: 0 },
      timestamp: msg.timestamp || msg.blk?.t || Math.floor(Date.now() / 1000),
      MAP: msg.MAP,
      B: msg.B?.map((b) => ({
        encoding: b?.encoding || '',
        content: b?.content || '',
        "content-type": (b && b['content-type']) || ''
      })) || [],
    })),
    signers: signers.filter(s => s).map((s) => ({
      idKey: s.idKey,
      rootAddress: s.rootAddress,
      currentAddress: s.currentAddress,
      addresses: s.addresses,
      block: s.block || 0,
      timestamp: s.timestamp || 0,
      valid: s.valid ?? true,
      identityTxId: s.identityTxId || '',
      identity: s.identity,
    })),
  };
}