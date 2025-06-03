import { getBAPIdentites, getSigners } from '../bap.js';
import { getDbo } from '../db.js';
import { NotFoundError } from '../middleware/errorHandler.js';
import { fetchBapIdentityData } from '../social/queries/identity.js';
import type { BapIdentity } from '../types.js';
import type {
  PostMeta,
  PostResponse,
  PostTransaction,
  PostsParams,
  PostsResponse,
  RepliesParams,
  SearchParams,
} from '../types.js';

// All interfaces now imported from types.ts

// Helper function to normalize post data
function normalizePost(post: PostTransaction): PostTransaction {
  return {
    ...post,
    tx: { h: post.tx?.h || '' },
    blk: post.blk || { i: 0, t: 0 },
    timestamp: post.timestamp || post.blk?.t || Math.floor(Date.now() / 1000),
    MAP:
      post.MAP?.map((m) => ({
        ...m,
        bapID: m.bapID || '',
      })) || [],
    B:
      post.B?.map((b) => ({
        encoding: b?.encoding || '',
        content: b?.content || '',
        'content-type': b?.['content-type'] || '',
        filename: b?.filename || '',
      })) || [],
  };
}

// Helper function to create the common aggregation pipeline for posts with meta
function createPostMetaPipeline(skipSteps?: unknown[]): unknown[] {
  const pipeline = [];

  // Add any skip steps (like match, sort, skip, limit)
  if (skipSteps) {
    pipeline.push(...skipSteps);
  }

  // Common pipeline steps
  pipeline.push(
    // Put the post in a property called "post"
    {
      $replaceRoot: {
        newRoot: {
          post: '$$ROOT', // Store the entire document as "post"
        },
      },
    },

    // Lookup to get replies
    {
      $lookup: {
        from: 'post',
        localField: 'post._id',
        foreignField: 'MAP.tx',
        as: 'replies',
      },
    },

    // Lookup to get likes
    {
      $lookup: {
        from: 'like',
        localField: 'post._id',
        foreignField: 'MAP.tx',
        as: 'likes',
      },
    },

    // Calculate total likes before unwinding
    {
      $addFields: {
        totalLikes: { $size: { $ifNull: ['$likes', []] } }, // Count the total number of likes
      },
    },

    // Unwind likes to process emoji reactions
    { $unwind: { path: '$likes', preserveNullAndEmptyArrays: true } },

    // Group by post ID and emoji to count reactions
    {
      $group: {
        _id: {
          postId: '$post._id',
          emoji: { $arrayElemAt: ['$likes.MAP.emoji', 0] }, // Extract the first element of the emoji array
        },
        post: { $first: '$post' },
        replies: { $first: '$replies' }, // Preserve the replies field
        totalLikes: { $first: '$totalLikes' }, // Preserve the total likes count
        count: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $ne: ['$likes.MAP.emoji', null] },
                  { $ne: ['$likes.MAP.emoji', undefined] },
                  { $ne: ['$likes.MAP.emoji', ''] }, // Exclude empty strings
                ],
              },
              1,
              0,
            ],
          },
        },
      },
    },

    // Group by post ID to consolidate reactions
    {
      $group: {
        _id: '$_id.postId',
        post: { $first: '$post' },
        replies: { $first: '$replies' }, // Preserve the replies field
        totalLikes: { $first: '$totalLikes' }, // Preserve the total likes count
        reactions: {
          $push: {
            $cond: [
              {
                $and: [
                  { $ne: ['$_id.emoji', null] },
                  { $ne: ['$_id.emoji', undefined] },
                  { $ne: ['$_id.emoji', ''] },
                  { $ifNull: ['$_id.emoji', false] },
                ],
              },
              {
                emoji: '$_id.emoji', // Use the flattened emoji value
                count: '$count',
              },
              '$$REMOVE', // Exclude likes without a valid emoji
            ],
          },
        },
      },
    },

    // Add the meta property with replies, likes, and reactions
    {
      $addFields: {
        meta: {
          tx: '$post.tx.h',
          replies: { $size: { $ifNull: ['$replies', []] } }, // Count the number of replies
          likes: '$totalLikes', // Use the pre-calculated total likes count
          reactions: '$reactions', // Add the reactions array
        },
      },
    }
  );

  return pipeline;
}

export async function getPost(txid: string): Promise<PostResponse> {
  const dbo = await getDbo();

  const aggregationPipeline = createPostMetaPipeline([
    // Match the posts we want
    { $match: { _id: txid } },
  ]);

  const posts = await dbo
    .collection<PostTransaction>('post')
    .aggregate(aggregationPipeline)
    .toArray();

  if (!posts.length) {
    throw new NotFoundError(`Post with txid ${txid} not found`);
  }

  const { post, meta } = posts[0];
  const signerAddresses = new Set<string>();
  for (const aip of post.AIP || []) {
    if (aip.address) {
      signerAddresses.add(aip.address);
    }
  }

  const signers = await getSigners([...signerAddresses]);

  return {
    post: normalizePost(post),
    signers,
    meta,
  };
}

export async function getReplies({
  txid,
  page = 1,
  limit = 100,
}: RepliesParams): Promise<PostsResponse> {
  const dbo = await getDbo();
  const skip = (page - 1) * limit;
  const query = { 'MAP.tx': txid };

  const aggregationPipeline = createPostMetaPipeline([
    // Match the posts we want
    { $match: query },
    // Sort by timestamp descending (newest first)
    { $sort: { timestamp: -1 } },
    // Pagination
    { $skip: skip },
    { $limit: limit },
  ]);

  const [results, count] = await Promise.all([
    dbo.collection('post').aggregate(aggregationPipeline).toArray(),
    dbo.collection('post').countDocuments(query),
  ]);

  // Get unique signer addresses
  const signerAddresses = new Set<string>();
  for (const doc of results) {
    if (!doc.post.AIP) continue;
    for (const aip of doc.post.AIP) {
      if (aip.address) {
        signerAddresses.add(aip.address);
      }
    }
  }

  // Get BAP identities for all signers
  const signers = await getSigners([...signerAddresses]);

  return {
    page,
    limit,
    count,
    results: results.map((doc) => normalizePost(doc.post)),
    signers,
    meta: results.map((doc) => doc.meta),
  };
}

export async function getPosts({
  bapId,
  address,
  feed = false,
  page = 1,
  limit = 100,
}: PostsParams): Promise<PostsResponse> {
  const dbo = await getDbo();
  const skip = (page - 1) * limit;

  const query: {
    'MAP.tx': null;
    'AIP.address'?: string | { $in: string[] };
  } = {
    'MAP.tx': null,
  };

  let follows: Map<string, BapIdentity> | undefined;
  if (address) {
    query['AIP.address'] = address;
  } else if (bapId) {
    if (feed) {
      const following = await getFollows(bapId);
      if (!following?.length) {
        return {
          bapID: bapId,
          page,
          limit,
          count: 0,
          results: [],
          signers: [],
          meta: [],
        };
      }
      follows = new Map<string, BapIdentity>();
      const addresses = new Set<string>();
      for (const f of following) {
        for (const a of f.addresses) {
          if (a.address) {
            follows.set(a.address, f);
            addresses.add(a.address);
          }
        }
      }
      if (addresses.size) {
        query['AIP.address'] = { $in: [...addresses] };
      }
    } else {
      const identity = await fetchBapIdentityData(bapId);
      if (!identity?.currentAddress) {
        throw new Error('Invalid BAP identity data');
      }
      query['AIP.address'] = { $in: identity.addresses.map((a) => a.address) };
    }
  }

  const aggregationPipeline = createPostMetaPipeline([
    // Match the posts we want
    { $match: query },
    // Sort by timestamp descending (newest first)
    { $sort: { timestamp: -1 } },
    // Pagination
    { $skip: skip },
    { $limit: limit },
  ]);

  // const [results, count] = await Promise.all([
  //     dbo.collection('post').aggregate(aggregationPipeline).toArray(),
  //     dbo.collection('post').countDocuments(query),
  // ]);

  const results = await dbo.collection('post').aggregate(aggregationPipeline).toArray();
  let signers: BapIdentity[] = [];
  const signerAddresses = new Set<string>();
  if (feed && bapId && follows) {
    for (const doc of results) {
      if (!doc.post.AIP) continue;
      for (const aip of doc.post.AIP) {
        if (aip.address && follows.has(aip.address) && !signerAddresses.has(aip.address)) {
          signers.push(follows.get(aip.address));
          signerAddresses.add(aip.address);
        }
      }
    }
  } else {
    // Get unique signer addresses
    for (const doc of results) {
      if (!doc.post.AIP) continue;
      for (const aip of doc.post.AIP) {
        if (aip.address) {
          signerAddresses.add(aip.address);
        }
      }
    }
    // Get BAP identities for all signers
    signers = await getSigners([...signerAddresses]);
  }

  return {
    bapID: bapId,
    page,
    limit,
    count: results.length,
    results: results.map((doc) => normalizePost(doc.post)),
    signers,
    meta: results.map((doc) => doc.meta),
  };
}

async function getFollows(bapId: string) {
  const dbo = await getDbo();
  const identity = await fetchBapIdentityData(bapId);
  if (!identity?.currentAddress) {
    throw new Error('Invalid BAP identity data');
  }

  const userAddresses = identity.addresses.map((a) => a.address);

  const follows = await dbo
    .collection('follow')
    .find(
      {
        'AIP.address': { $in: userAddresses },
      },
      {
        sort: [
          ['AIP.address', 1],
          ['blk.i', 1],
        ],
        projection: {
          'blk.i': 1,
          'MAP.idKey': 1,
        },
      }
    )
    .toArray();

  const unfollows = await dbo
    .collection('unfollow')
    .find(
      {
        'AIP.address': { $in: userAddresses },
      },
      {
        sort: [
          ['AIP.address', 1],
          ['blk.i', 1],
        ],
        projection: {
          'blk.i': 1,
          'MAP.idKey': 1,
        },
      }
    )
    .toArray();

  const followMap = new Map<string, number>();

  // Process follows
  for (const follow of follows) {
    const idKey = follow.MAP?.find((m) => m.idKey)?.idKey;
    const blockIndex = follow.blk?.i;

    if (idKey && typeof blockIndex === 'number') {
      followMap.set(idKey, blockIndex);
    }
  }

  // Process unfollows
  for (const unfollow of unfollows) {
    const idKey = unfollow.MAP?.find((m) => m.idKey)?.idKey;
    const blockIndex = unfollow.blk?.i;

    if (idKey && typeof blockIndex === 'number') {
      if (followMap.has(idKey)) {
        if (blockIndex > followMap.get(idKey)) {
          followMap.delete(idKey);
        }
      }
    }
  }

  return getBAPIdentites([...followMap.keys()]);
}

export async function searchPosts({
  q,
  limit = 10,
  offset = 0,
}: SearchParams): Promise<PostsResponse> {
  const db = await getDbo();
  const postCollection = db.collection<PostTransaction>('post');

  let results: PostTransaction[] = [];
  try {
    // First try MongoDB Atlas Search
    const pipeline = [
      { $search: { index: 'default', text: { query: q, path: { wildcard: '*' } } } },
      { $skip: offset },
      { $limit: limit },
    ];

    // MongoDB aggregate always returns Document[], we need to cast to our type
    const aggregateResults = await postCollection.aggregate(pipeline).toArray();
    results = aggregateResults.map((doc) => doc as PostTransaction);
  } catch (error) {
    console.warn('Atlas Search failed, falling back to text search:', error);

    // Fallback to regex text search on B.content
    const textQuery = {
      'MAP.tx': null,
      'B.content': { $regex: q, $options: 'i' },
    };

    // find() with proper typing returns the correct type
    results = await postCollection
      .find(textQuery)
      .sort({ timestamp: -1 })
      .skip(offset)
      .limit(limit)
      .toArray();
  }

  // Get unique signer addresses from results
  const signerAddresses = new Set<string>();
  for (const doc of results) {
    if (!doc.AIP) continue;
    for (const aip of doc.AIP) {
      if (aip.address) {
        signerAddresses.add(aip.address);
      }
    }
  }

  // Get BAP identities for all signers
  const signers = await getSigners([...signerAddresses]);

  const page = Math.floor(offset / limit) + 1;

  return {
    page,
    limit,
    count: results.length,
    results: results.map((doc) => normalizePost(doc)),
    signers,
    meta: [], // TODO: Add meta data for search results if needed
  };
}
