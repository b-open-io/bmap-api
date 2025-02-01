import type { BapIdentity } from '../../bap.js';
import { getBAPIdByAddress } from '../../bap.js';
import type { CacheValue } from '../../cache.js';
import { readFromRedis, saveToRedis } from '../../cache.js';
import { getDbo } from '../../db.js';
import type { LikeRequest, LikeInfo, Reaction } from '../swagger/likes.js';
import { validateSignerData } from './identity.js';

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
      if (!aip.algorithm_signing_component) {
        console.warn('Invalid AIP entry - missing algorithm_signing_component:', like.tx?.h);
        continue;
      }
      signerAddresses.add(aip.algorithm_signing_component);
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

export async function getLikes(request: LikeRequest): Promise<LikeInfo[]> {
  if (!request.txids && !request.messageIds) {
    throw new Error('Must provide either txids or messageIds');
  }

  const db = await getDbo();
  const results: LikeInfo[] = [];

  if (request.txids) {
    for (const txid of request.txids) {
      const likes = (await db
        .collection('like')
        .find({
          'MAP.type': 'like',
          'MAP.tx': txid,
        })
        .toArray()) as unknown as Reaction[];

      const { signers } = await processLikes(likes);

      results.push({
        txid,
        likes,
        total: likes.length,
        signers,
      });
    }
  }

  if (request.messageIds) {
    for (const messageId of request.messageIds) {
      const likes = (await db
        .collection('like')
        .find({
          'MAP.type': 'like',
          'MAP.messageID': messageId,
        })
        .toArray()) as unknown as Reaction[];

      const { signers } = await processLikes(likes);

      results.push({
        txid: messageId,
        likes,
        total: likes.length,
        signers,
      });
    }
  }

  return results;
}
