import type { BmapTx } from 'bmapjs';
import type { Db } from 'mongodb';
import { getSigners } from '../../bap.js';
import type { CacheValue } from '../../cache.js';
import { readFromRedis, saveToRedis } from '../../cache.js';
import { COLLECTIONS, PROTOCOL_START_BLOCK } from '../../config/constants.js';
import { getDbo } from '../../db.js';
import type { BapIdentity } from '../../types.js';

export interface ActivityParams {
  limit?: number;
  blocks?: number;
  types?: string[];
}

export interface ActivityResponse {
  results: Array<BmapTx & { collection: string }>;
  signers: BapIdentity[];
  meta: {
    limit: number;
    blocks: number | null;
    collections: string[];
    cached: boolean;
  };
}

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

const ACTIVITY_COLLECTIONS = {
  friend: COLLECTIONS.FRIEND,
  message: COLLECTIONS.MESSAGE,
  like: COLLECTIONS.LIKE,
  pin_channel: COLLECTIONS.PIN_CHANNEL,
};

export async function getRecentActivity(params: ActivityParams): Promise<ActivityResponse> {
  const limit = Math.min(params.limit || DEFAULT_LIMIT, MAX_LIMIT);
  const blocks = params.blocks || null;
  const types = params.types || Object.keys(ACTIVITY_COLLECTIONS);

  // Validate types
  const validTypes = types.filter((t) => t in ACTIVITY_COLLECTIONS);
  if (validTypes.length === 0) {
    throw new Error('No valid activity types specified');
  }

  // Generate cache key
  const cacheKey = `activity:${validTypes.sort().join(',')}:${limit}:${blocks || 'all'}`;

  // Check cache
  const cached = await readFromRedis<CacheValue>(cacheKey);
  if (cached?.type === 'activity') {
    return {
      ...cached.value,
      meta: {
        ...cached.value.meta,
        cached: true,
      },
    };
  }

  const dbo = await getDbo();

  // Build block filter
  let blockFilter: Record<string, unknown> = {};
  if (blocks) {
    const currentHeight = await getCurrentBlockHeight(dbo);
    blockFilter = {
      'blk.i': {
        $gte: currentHeight - blocks,
      },
    };
  } else {
    // Only include confirmed transactions or recent unconfirmed
    blockFilter = {
      $or: [{ 'blk.i': { $gte: PROTOCOL_START_BLOCK } }, { 'blk.i': 0 }],
    };
  }

  // Query all collections in parallel
  const collectionQueries = validTypes.map(async (type) => {
    const collectionName = ACTIVITY_COLLECTIONS[type as keyof typeof ACTIVITY_COLLECTIONS];

    try {
      const results = await dbo
        .collection(collectionName)
        .find({
          'MAP.type': type,
          ...blockFilter,
        })
        .sort({ 'blk.t': -1, timestamp: -1 })
        .limit(limit)
        .toArray();

      // Add collection name to each result
      return results.map((doc) => ({
        ...(doc as BmapTx),
        collection: type,
      }));
    } catch (error) {
      console.error(`Error querying ${collectionName}:`, error);
      return [];
    }
  });

  const allResults = await Promise.all(collectionQueries);

  // Merge and sort all results by timestamp
  const mergedResults = allResults
    .flat()
    .sort((a, b) => {
      const timeA = a.blk?.t || a.timestamp || 0;
      const timeB = b.blk?.t || b.timestamp || 0;
      return timeB - timeA; // Descending order (newest first)
    })
    .slice(0, limit * validTypes.length); // Limit total results

  // Get unique signer addresses
  const signerAddresses = new Set<string>();
  for (const tx of mergedResults) {
    if (tx.AIP) {
      for (const aip of tx.AIP) {
        if (aip.address) {
          signerAddresses.add(aip.address);
        }
      }
    }
  }

  // Resolve signers
  const signers = await getSigners([...signerAddresses]);

  const response: ActivityResponse = {
    results: mergedResults,
    signers,
    meta: {
      limit,
      blocks,
      collections: validTypes,
      cached: false,
    },
  };

  // Cache the response
  await saveToRedis<CacheValue>(
    cacheKey,
    {
      type: 'activity',
      value: response,
    },
    30 // 30 second TTL
  );

  return response;
}

async function getCurrentBlockHeight(db: Db): Promise<number> {
  try {
    const state = await db.collection('_state').findOne({});
    return state?.height || PROTOCOL_START_BLOCK;
  } catch (error) {
    console.error('Error getting block height:', error);
    return PROTOCOL_START_BLOCK;
  }
}
