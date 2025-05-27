import type { BmapTx } from 'bmapjs';
import { Elysia, t } from 'elysia';
import type { ChangeStreamInsertDocument, Db } from 'mongodb';
import { getBAPIdByAddress, resolveSigners, searchIdentities } from '../bap.js';
import type { BapIdentity } from '../bap.js';
import { client, readFromRedis, saveToRedis } from '../cache.js';
import type { CacheError, CacheSigner, CacheValue } from '../cache.js';
import { CACHE_TTL, DEFAULT_PAGE, DEFAULT_PAGE_SIZE } from '../config/constants.js';
import { getDbo } from '../db.js';
import { NotFoundError, ServerError, ValidationError } from '../middleware/errorHandler.js';
import { getDirectMessages, watchAllMessages, watchDirectMessages } from '../queries/messages.js';
import { getChannels } from './queries/channels.js';
import { fetchAllFriendsAndUnfriends, processRelationships } from './queries/friends.js';
import { fetchBapIdentityData } from './queries/identity.js';
import { getLikes, processLikes } from './queries/likes.js';
import { updateSignerCache, getChannelMessages } from './queries/messages.js';
// Import consolidated schemas and types
import {
  type ChannelMessage,
  type ChannelMessageResponse,
  ChannelMessageSchema,
  ChannelParams,
  ChannelResponseSchema,
  DMResponseSchema,
  FriendResponseSchema,
  IdentityResponseSchema,
  type LikeInfo,
  type LikeRequest,
  LikeRequestSchema,
  LikeResponseSchema,
  type LikesQueryRequest,
  type BaseMessage as Message,
  MessageListenParams,
  PaginationQuery,
  type Post,
  PostQuery,
  PostResponseSchema,
  PostsResponseSchema,
} from './schemas.js';

import { getPost, getPosts, getReplies, searchPosts } from '../queries/posts.js';
// Import swagger endpoint details
import { channelsEndpointDetail } from './swagger/channels.js';
import { friendEndpointDetail } from './swagger/friend.js';
import { identityEndpointDetail } from './swagger/identity.js';
import { likesEndpointDetail } from './swagger/likes.js';
import {
  channelMessagesEndpointDetail,
  directMessagesEndpointDetail,
  directMessagesWithTargetEndpointDetail,
  messageListenEndpointDetail,
} from './swagger/messages.js';

// Validation helper for signer data
function validateSignerData(signer: BapIdentity): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!signer.idKey) errors.push('Missing idKey');
  if (!signer.currentAddress) errors.push('Missing currentAddress');
  if (!signer.rootAddress) errors.push('Missing rootAddress');
  if (!signer.addresses || !signer.addresses.length) errors.push('Missing addresses');

  return {
    isValid: errors.length === 0,
    errors,
  };
}

export const socialRoutes = new Elysia()
  .get(
    '/channels',
    async ({ set }) => {
      try {
        const channels = await getChannels();
        Object.assign(set.headers, {
          'Cache-Control': 'public, max-age=60',
        });
        return channels;
      } catch (err) {
        console.error('Route handler error:', err);
        set.status = 500;
        Object.assign(set.headers, {
          'Cache-Control': 'no-store',
        });
        return {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch channels',
        };
      }
    },
    {
      detail: channelsEndpointDetail,
      response: t.Union([
        ChannelResponseSchema,
        t.Object({
          code: t.String(),
          message: t.String(),
        }),
      ]),
    }
  )
  .get(
    '/channels/:channelId/messages',
    async ({ params, query, set }) => {
      try {
        const { channelId } = params;
        if (!channelId) {
          throw new ValidationError('Missing channel ID');
        }

        const decodedChannelId = decodeURIComponent(channelId);

        const page = query.page ? Number.parseInt(query.page, 10) : 1;
        const limit = query.limit ? Number.parseInt(query.limit, 10) : 100;

        if (Number.isNaN(page) || page < 1) {
          throw new ValidationError('Invalid page parameter');
        }

        if (Number.isNaN(limit) || limit < 1 || limit > 1000) {
          throw new ValidationError('Invalid limit parameter');
        }

        const skip = (page - 1) * limit;

        const cacheKey = `messages:${decodedChannelId}:${page}:${limit}`;
        const cached = await readFromRedis<CacheValue>(cacheKey);

        if (cached?.type === 'messages') {
          Object.assign(set.headers, {
            'Cache-Control': 'public, max-age=60',
          });
          // Type guard to ensure we have the right cached value type
          if ('page' in cached.value && 'results' in cached.value) {
            // Return only results and signers to match client expectations
            return {
              results: cached.value.results || [],
              signers: cached.value.signers || [],
            };
          }
          // If it's not the expected format, fall through to fetch fresh data
          console.warn('Cached value has unexpected format');
        }

        // Use the getChannelMessages function which properly handles data transformation
        const response = await getChannelMessages({ channelId: decodedChannelId, page, limit });

        await saveToRedis<CacheValue>(cacheKey, {
          type: 'messages',
          value: response,
        });

        Object.assign(set.headers, {
          'Cache-Control': 'public, max-age=60',
        });
        // Return only results and signers to match client expectations
        return {
          results: response.results,
          signers: response.signers,
        };
      } catch (error: unknown) {
        console.error('Error fetching messages:', error);
        set.status = 500;
        // Return a properly structured response with empty arrays
        return {
          results: [],
          signers: [],
        };
      }
    },
    {
      params: ChannelParams,
      query: PaginationQuery,
      response: ChannelMessageSchema,
      detail: channelMessagesEndpointDetail,
    }
  )
  .get('/autofill', async ({ query }) => {
    try {
      const { q } = query;
      if (!q) {
        throw new Error('q param is required');
      }

      const cached = await client.hGet('autofill', q);
      if (cached) {
        return {
          status: 'OK',
          result: JSON.parse(cached),
        };
      }
      const [identites, posts] = await Promise.all([
        searchIdentities({ q, limit: 3, offset: 0 }),
        searchPosts({ q, limit: 10, offset: 0 }),
      ]);

      const result = {
        identities: identites,
        posts: posts,
      };
      client.hSet('autofill', q, JSON.stringify(result));
      client.hExpire('autofill', q, CACHE_TTL.AUTOFILL);
      return {
        status: 'OK',
        result: result,
      };
    } catch (error: unknown) {
      console.error('Error fetching autofill data:', error);
      throw new Error('Failed to fetch autofill data');
    }
  })
  .get('/identity/search', async ({ query }) => {
    try {
      const { q, limit, offset } = query;
      if (!q) {
        throw new Error('q param is required');
      }

      const results = await searchIdentities({
        q,
        limit: limit ? Number.parseInt(limit, 10) : 100,
        offset: offset ? Number.parseInt(offset, 10) : 0,
      });

      return {
        status: 'OK',
        result: results,
      };
    } catch (error: unknown) {
      console.error('Error fetching autofill data:', error);
      throw new Error('Failed to fetch autofill data');
    }
  }, {
    query: t.Object({
      q: t.String({ description: 'Search query' }),
      limit: t.Optional(t.String({ description: 'Number of results to return' })),
      offset: t.Optional(t.String({ description: 'Offset for pagination' })),
    }),
    response: t.Object({
      status: t.String(),
      result: IdentityResponseSchema,
    }),
    detail: {
      tags: ['identities'],
      summary: 'Search identities',
      description: 'Search for BAP identities by name, paymail, or other attributes',
    }
  })
  .get('/post/search', async ({ query }) => {
    try {
      const { q, limit, offset } = query;
      if (!q) {
        throw new Error('q param is required');
      }

      const results = await searchPosts({
        q,
        limit: limit ? Number.parseInt(limit, 10) : 100,
        offset: offset ? Number.parseInt(offset, 10) : 0,
      });

      return {
        status: 'OK',
        result: results,
      };
    } catch (error: unknown) {
      console.error('Error fetching autofill data:', error);
      throw new Error('Failed to fetch autofill data');
    }
  }, {
    query: t.Object({
      q: t.String({ description: 'Search query' }),
      limit: t.Optional(t.String({ description: 'Number of results to return' })),
      offset: t.Optional(t.String({ description: 'Offset for pagination' })),
    }),
    response: PostsResponseSchema,
    detail: {
      tags: ['posts'],
      summary: 'Search posts',
      description: 'Search posts by content or metadata',
    }
  })
  .get(
    '/feed/:bapId?',
    async ({ set, query, params }) => {
      try {
        const postQuery = {
          bapId: params.bapId,
          page: query.page ? Number.parseInt(query.page, 10) : 1,
          limit: query.limit ? Number.parseInt(query.limit, 10) : 100,
          feed: true,
        };
        return getPosts(postQuery);
      } catch (error: unknown) {
        console.error('Error fetching feed:', error);
        set.status = 500;
        return {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch feed',
        };
      }
    },
    {
      query: PostQuery,
    }
  )
  .get(
    '/post/:txid',
    async ({ set, params }) => {
      try {
        return getPost(params.txid);
      } catch (error: unknown) {
        console.error('Error fetching feed:', error);
        set.status = 500;
        return {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch feed',
        };
      }
    },
    {
      query: PostQuery,
      response: PostResponseSchema,
      detail: {
        tags: ['posts'],
        summary: 'Get single post by transaction ID',
        description: 'Retrieves a single post with metadata and signers',
      }
    }
  )
  .get(
    '/post/:txid/reply',
    async ({ set, query, params }) => {
      try {
        const repliesQuery = {
          txid: params.txid,
          page: query.page ? Number.parseInt(query.page, 10) : 1,
          limit: query.limit ? Number.parseInt(query.limit, 10) : 100,
        };
        return getReplies(repliesQuery);
      } catch (error: unknown) {
        console.error('Error fetching feed:', error);
        set.status = 500;
        return {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch feed',
        };
      }
    },
    {
      query: PostQuery,
      response: PostsResponseSchema,
      detail: {
        tags: ['posts'],
        summary: 'Get replies to a post',
        description: 'Retrieves all replies to a specific post by transaction ID',
      }
    }
  )
  .get(
    '/post/:txid/like',
    async ({ set, query, params }) => {
      try {
        const repliesQuery = {
          txid: params.txid,
          page: query.page ? Number.parseInt(query.page, 10) : 1,
          limit: query.limit ? Number.parseInt(query.limit, 10) : 100,
        };
        return getLikes(repliesQuery);
      } catch (error: unknown) {
        console.error('Error fetching feed:', error);
        set.status = 500;
        return {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch feed',
        };
      }
    },
    {
      query: PostQuery,
    }
  )
  .get(
    '/post/address/:address',
    async ({ set, query, params }) => {
      try {
        const postQuery = {
          address: params.address,
          page: query.page ? Number.parseInt(query.page, 10) : 1,
          limit: query.limit ? Number.parseInt(query.limit, 10) : 100,
        };
        return getPosts(postQuery);
      } catch (error: unknown) {
        console.error('Error fetching feed:', error);
        set.status = 500;
        return {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch feed',
        };
      }
    },
    {
      query: PostQuery,
      response: PostsResponseSchema,
      detail: {
        tags: ['posts'],
        summary: 'Get posts by address',
        description: 'Retrieves all posts from a specific Bitcoin address',
      }
    }
  )
  .get(
    '/post/bap/:bapId',
    async ({ query, params }) => {
      try {
        const postQuery = {
          bapId: params.bapId,
          page: query.page ? Number.parseInt(query.page, 10) : 1,
          limit: query.limit ? Number.parseInt(query.limit, 10) : 100,
        };
        return getPosts(postQuery);
      } catch (error: unknown) {
        console.error('Error fetching posts:', error);
        throw new ServerError('Failed to fetch posts');
      }
    },
    {
      query: PostQuery,
      response: PostsResponseSchema,
    }
  )
  .get(
    '/bap/:bapId/like',
    async ({ set, query, params }) => {
      try {
        const repliesQuery = {
          bapId: params.bapId,
          page: query.page ? Number.parseInt(query.page, 10) : 1,
          limit: query.limit ? Number.parseInt(query.limit, 10) : 100,
        };
        return getLikes(repliesQuery);
      } catch (error: unknown) {
        console.error('Error fetching feed:', error);
        set.status = 500;
        return {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch feed',
        };
      }
    },
    {
      query: PostQuery,
      response: PostsResponseSchema,
      detail: {
        tags: ['social'],
        summary: 'Get likes by BAP ID',
        description: 'Retrieves all likes made by a specific BAP identity',
      }
    }
  )
  .post(
    '/likes',
    async ({ body }) => {
      try {
        const request = body as LikesQueryRequest;
        if (!request.txids && !request.messageIds) {
          throw new Error('Must provide either txids or messageIds');
        }

        const db = await getDbo();
        const results: LikeInfo[] = [];

        if (request.txids) {
          for (const txid of request.txids) {
            const likes = await db
              .collection('like')
              .find({
                'MAP.type': 'like',
                'MAP.tx': txid,
              })
              .toArray();

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
            const likes = await db
              .collection('like')
              .find({
                'MAP.type': 'like',
                'MAP.messageID': messageId,
              })
              .toArray();

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
      } catch (error: unknown) {
        console.error('Error processing likes:', error);
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to process likes: ${message}`);
      }
    },
    {
      body: LikeRequestSchema,
      response: LikeResponseSchema,
      detail: likesEndpointDetail,
    }
  )
  .get(
    '/friend/:bapId',
    async ({ params, set }) => {
      try {
        const { bapId } = params;
        if (!bapId) {
          set.status = 400;
          return {
            friends: [],
            incoming: [],
            outgoing: [],
          };
        }

        try {
          // First verify the BAP ID exists by trying to fetch its identity
          const identity = await fetchBapIdentityData(bapId);
          if (!identity) {
            set.status = 404;
            return {
              friends: [],
              incoming: [],
              outgoing: [],
            };
          }

          const { allDocs, ownedAddresses } = await fetchAllFriendsAndUnfriends(bapId);
          return processRelationships(bapId, allDocs, ownedAddresses);
        } catch (error) {
          // If we get an error fetching the BAP identity, return 404
          console.error('Error fetching BAP identity:', error);
          set.status = 404;
          return {
            friends: [],
            incoming: [],
            outgoing: [],
          };
        }
      } catch (error: unknown) {
        console.error('Error processing friend request:', error);
        set.status = 500;
        return {
          friends: [],
          incoming: [],
          outgoing: [],
        };
      }
    },
    {
      params: t.Object({
        bapId: t.String(),
      }),
      response: FriendResponseSchema,
      detail: friendEndpointDetail,
    }
  )
  .get(
    '/@/:bapId/messages',
    async ({ params, query, set }) => {
      try {
        const response = await getDirectMessages({
          bapId: params.bapId,
          page: query.page ? Number.parseInt(query.page, 10) : 1,
          limit: query.limit ? Number.parseInt(query.limit, 10) : 100,
        });

        Object.assign(set.headers, { 'Cache-Control': 'public, max-age=60' });
        return response;
      } catch (error) {
        console.error('DM messages error:', error);
        set.status = 500;
        return {
          bapID: params.bapId,
          page: DEFAULT_PAGE,
          limit: DEFAULT_PAGE_SIZE,
          count: 0,
          results: [],
          signers: [],
        };
      }
    },
    {
      params: t.Object({ bapId: t.String() }),
      query: PaginationQuery,
      response: DMResponseSchema,
      detail: directMessagesEndpointDetail,
    }
  )
  .get(
    '/@/:bapId/messages/:targetBapId',
    async ({ params, query, set }) => {
      try {
        const response = await getDirectMessages({
          bapId: params.bapId,
          targetBapId: params.targetBapId,
          page: query.page ? Number.parseInt(query.page, 10) : 1,
          limit: query.limit ? Number.parseInt(query.limit, 10) : 100,
        });

        Object.assign(set.headers, { 'Cache-Control': 'public, max-age=60' });
        return response;
      } catch (error) {
        console.error('DM messages error:', error);
        set.status = 500;
        return {
          bapID: params.bapId,
          page: DEFAULT_PAGE,
          limit: DEFAULT_PAGE_SIZE,
          count: 0,
          results: [],
          signers: [],
        };
      }
    },
    {
      params: t.Object({ bapId: t.String(), targetBapId: t.String() }),
      query: PaginationQuery,
      response: DMResponseSchema,
      detail: directMessagesWithTargetEndpointDetail,
    }
  )
  .ws('/@/:bapId/messages/:targetBapId/listen', {
    body: MessageListenParams,
    open: async (ws) => {
      const { bapId, targetBapId } = ws.data.params;
      const identity = await fetchBapIdentityData(bapId);
      if (!identity?.currentAddress) {
        throw new Error(`Invalid BAP identity data for bapId: ${bapId}`);
      }
      const bapAddress = identity.currentAddress;
      const targetIdentity = await fetchBapIdentityData(targetBapId);
      if (!targetIdentity?.currentAddress) {
        throw new Error('Invalid target BAP identity');
      }
      const targetAddress = targetIdentity.currentAddress;

      const cursor = await watchDirectMessages({
        bapId,
        bapAddress,
        targetBapId,
        targetAddress,
      });

      cursor.on('change', (change: ChangeStreamInsertDocument<BmapTx>) => {
        ws.send(change.fullDocument?.tx.h);
      });
    },
    detail: messageListenEndpointDetail,
  })
  .ws('/@/:bapId/messages/listen', {
    body: MessageListenParams,
    open: async (ws) => {
      const { bapId } = ws.data.params;
      const identity = await fetchBapIdentityData(bapId);
      if (!identity?.currentAddress) {
        ws.close(4403, 'Invalid BAP identity');
        console.error('Invalid BAP identity:', identity);
        return;
        // throw new Error('Invalid BAP identity');
      }
      const bapAddress = identity.currentAddress;

      const cursor = await watchAllMessages({
        bapId,
        bapAddress,
      });

      cursor.on('change', (change: ChangeStreamInsertDocument<BmapTx>) => {
        ws.send({
          tx: change.fullDocument?.tx.h,
          targetBapID: change.fullDocument?.MAP?.[0]?.bapID,
          address: change.fullDocument?.AIP?.[0]?.address,
        });
      });
    },
    detail: messageListenEndpointDetail,
  })
  .get(
    '/identities',
    async ({ set }) => {
      try {
        // Check Redis connection
        console.log('Checking Redis connection...');
        if (!client.isReady) {
          console.error('Redis client is not ready');
          set.status = 503;
          return [];
        }

        // First try to get the cached identities list
        const identitiesCacheKey = 'identities';
        const cachedIdentities = await readFromRedis<CacheValue | CacheError>(identitiesCacheKey);

        if (cachedIdentities?.type === 'identities' && Array.isArray(cachedIdentities.value)) {
          Object.assign(set.headers, {
            'Cache-Control': 'public, max-age=60',
          });
          return cachedIdentities.value;
        }

        // If no cached list, get all signer-* keys from Redis
        const signerKeys = await client.keys('signer-*');

        if (!signerKeys.length) {
          return [];
        }

        // Get all cached signers
        const identities = await Promise.all(
          signerKeys.map(async (key) => {
            try {
              const cachedValue = await readFromRedis<CacheValue | CacheError>(key);
              if (cachedValue?.type === 'signer' && 'value' in cachedValue) {
                const identity = cachedValue.value;
                if (identity && validateSignerData(identity).isValid) {
                  return {
                    idKey: identity.idKey || '',
                    rootAddress: identity.rootAddress || '',
                    currentAddress: identity.currentAddress || '',
                    addresses: Array.isArray(identity.addresses)
                      ? identity.addresses.map((addr) => ({
                          address: addr.address || '',
                          txId: addr.txId || '',
                          block: typeof addr.block === 'number' ? addr.block : undefined,
                        }))
                      : [],
                    identity:
                      typeof identity.identity === 'string'
                        ? identity.identity
                        : typeof identity.identity === 'object'
                          ? identity.identity
                          : JSON.stringify(identity.identity || {}),
                    identityTxId: identity.identityTxId || '',
                    block: typeof identity.block === 'number' ? identity.block : 0,
                    timestamp: typeof identity.timestamp === 'number' ? identity.timestamp : 0,
                    valid: typeof identity.valid === 'boolean' ? identity.valid : true,
                  };
                }
              }
              return null;
            } catch (error) {
              console.error(`Error processing cached signer ${key}:`, error);
              return null;
            }
          })
        );

        const filteredIdentities = identities.filter((id) => id !== null) as BapIdentity[];

        console.log('\n=== Identity Processing Summary ===');
        console.log('Successfully processed:', filteredIdentities.length);
        console.log('Failed/invalid:', signerKeys.length - filteredIdentities.length);

        // Cache the filtered list
        await saveToRedis<CacheValue>(identitiesCacheKey, {
          type: 'identities',
          value: filteredIdentities,
        });

        Object.assign(set.headers, {
          'Cache-Control': 'public, max-age=60',
        });
        return filteredIdentities;
      } catch (error: unknown) {
        console.error('=== Error in /identities endpoint ===');
        console.error('Error details:', error);
        console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
        set.status = 500;
        return [];
      }
    },
    {
      response: IdentityResponseSchema,
      detail: identityEndpointDetail,
    }
  );
