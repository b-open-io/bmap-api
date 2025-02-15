import type { BmapTx } from 'bmapjs';
import { Elysia, t } from 'elysia';
import type { ChangeStreamInsertDocument, Db } from 'mongodb';
import { getBAPIdByAddress, resolveSigners } from '../bap.js';
import type { BapIdentity } from '../bap.js';
import { normalize } from '../bmap.js';
import { client, readFromRedis, saveToRedis } from '../cache.js';
import type { CacheError, CacheSigner, CacheValue } from '../cache.js';
import { getDbo } from '../db.js';
import { getDirectMessages, watchAllMessages, watchDirectMessages } from '../queries/messages.js';
import { getChannels } from './queries/channels.js';
import { fetchAllFriendsAndUnfriends, processRelationships } from './queries/friends.js';
import { fetchBapIdentityData } from './queries/identity.js';
import { getLikes, processLikes } from './queries/likes.js';
import { updateSignerCache } from './queries/messages.js';
import { ChannelResponseSchema, channelsEndpointDetail } from './swagger/channels.js';
import { ChannelParams } from './swagger/channels.js';
import { FriendResponseSchema, friendEndpointDetail } from './swagger/friend.js';
import { IdentityResponseSchema, identityEndpointDetail } from './swagger/identity.js';
import type { LikeInfo, LikeRequest, Reaction, Reactions } from './swagger/likes.js';
import { LikeRequestSchema, LikeResponseSchema } from './swagger/likes.js';
import { likesEndpointDetail } from './swagger/likes.js';
import type { ChannelMessage, Message } from './swagger/messages.js';
import {
  ChannelMessageSchema,
  DMResponseSchema,
  MessageListenParams,
  MessageQuery,
  channelMessagesEndpointDetail,
  messageListenEndpointDetail,
} from './swagger/messages.js';
import {
  directMessagesEndpointDetail,
  directMessagesWithTargetEndpointDetail,
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
          throw new Error('Missing channel ID');
        }

        const decodedChannelId = decodeURIComponent(channelId);

        const page = query.page ? Number.parseInt(query.page, 10) : 1;
        const limit = query.limit ? Number.parseInt(query.limit, 10) : 100;

        if (Number.isNaN(page) || page < 1) {
          throw new Error('Invalid page parameter');
        }

        if (Number.isNaN(limit) || limit < 1 || limit > 1000) {
          throw new Error('Invalid limit parameter');
        }

        const skip = (page - 1) * limit;

        const cacheKey = `messages:${decodedChannelId}:${page}:${limit}`;
        const cached = await readFromRedis<CacheValue>(cacheKey);

        if (cached?.type === 'messages') {
          console.log('Cache hit for messages:', cacheKey);
          Object.assign(set.headers, {
            'Cache-Control': 'public, max-age=60',
          });
          const response: ChannelMessage = {
            ...cached.value,
            channel: channelId,
            signers: cached.value.signers || [],
          };
          return response;
        }

        console.log('Cache miss for messages:', cacheKey);
        const db = await getDbo();

        const queryObj = {
          'MAP.type': 'message',
          'MAP.channel': decodedChannelId,
        };

        const col = db.collection('message');

        const count = await col.countDocuments(queryObj);

        const results = (await col
          .find(queryObj)
          .sort({ 'blk.t': -1 })
          .skip(skip)
          .limit(limit)
          .project({ _id: 0 })
          .toArray()) as Message[];

        // Normalize and validate each message
        const validatedResults = results.map((msg) => ({
          ...msg,
          tx: { h: msg.tx?.h || '' },
          blk: { i: msg.blk?.i || 0, t: msg.blk?.t || 0 },
          MAP: msg.MAP?.map((m) => ({
            app: m.app || '',
            type: m.type || '',
            channel: m.channel || '',
            paymail: m.paymail || '',
          })) || [
            {
              app: '',
              type: '',
              channel: '',
              paymail: '',
            },
          ],
          B: msg.B?.map((b) => ({
            encoding: b?.encoding || '',
            Data: {
              utf8: b.Data?.utf8 || '',
              data: b.Data?.data,
            },
          })) || [
            {
              encoding: '',
              Data: {
                utf8: '',
                data: '',
              },
            },
          ],
        }));

        // Initialize empty signers array with proper type
        let signers: BapIdentity[] = [];

        // Only try to resolve signers if there are messages with AIP data
        const messagesWithAIP = results.filter((msg) => msg.AIP && msg.AIP.length > 0);
        if (messagesWithAIP.length > 0) {
          try {
            signers = await resolveSigners(messagesWithAIP);
            console.log(`Resolved ${signers.length} signers`);
          } catch (error) {
            console.error('Error resolving signers:', error);
            // Don't throw - continue with empty signers array
          }
        } else {
          console.log('No messages with AIP data found');
        }

        // Ensure signers array is properly initialized with all required fields
        const validatedSigners: BapIdentity[] = signers.map((s) => ({
          ...s,
          identityTxId: s.identityTxId || '',
          identity:
            typeof s.identity === 'string'
              ? s.identity
              : typeof s.identity === 'object'
                ? s.identity
                : JSON.stringify(s.identity || {}),
        }));

        const response: ChannelMessage = {
          channel: channelId,
          page,
          limit,
          count,
          results: validatedResults,
          signers: validatedSigners,
        };

        await saveToRedis<CacheValue>(cacheKey, {
          type: 'messages',
          value: response,
        });

        Object.assign(set.headers, {
          'Cache-Control': 'public, max-age=60',
        });
        return response;
      } catch (error: unknown) {
        console.error('Error fetching messages:', error);
        set.status = 500;
        // Return a properly structured response with empty arrays
        const errorResponse: ChannelMessage = {
          channel: params.channelId || '',
          page: 1,
          limit: 100,
          count: 0,
          results: [
            {
              tx: { h: '' },
              blk: { i: 0, t: 0 },
              MAP: [{ app: '', type: '', channel: '', paymail: '' }],
              B: [{ encoding: '', Data: { utf8: '', data: '' } }],
            },
          ],
          signers: [],
        };
        return errorResponse;
      }
    },
    {
      params: ChannelParams,
      query: MessageQuery,
      response: ChannelMessageSchema,
      detail: channelMessagesEndpointDetail,
    }
  )
  .post(
    '/likes',
    async ({ body }) => {
      try {
        const request = body as LikeRequest;
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
          page: 1,
          limit: 100,
          count: 0,
          results: [],
          signers: [],
        };
      }
    },
    {
      params: t.Object({ bapId: t.String() }),
      query: MessageQuery,
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
          page: 1,
          limit: 100,
          count: 0,
          results: [],
          signers: [],
        };
      }
    },
    {
      params: t.Object({ bapId: t.String(), targetBapId: t.String() }),
      query: MessageQuery,
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
        throw new Error('Invalid BAP identity');
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
        throw new Error('Invalid BAP identity');
      }
      const bapAddress = identity.currentAddress;

      const cursor = await watchAllMessages({
        bapId,
        bapAddress,
      });

      cursor.on('change', (change: ChangeStreamInsertDocument<BmapTx>) => {
        ws.send({
          tx: change.fullDocument?.tx.h,
          bap_id: change.fullDocument?.MAP?.[0]?.bapID,
          algorithm_signing_component: change.fullDocument?.AIP?.[0]?.algorithm_signing_component,
          aip_address: change.fullDocument?.AIP?.[0]?.address,
        });
      });
    },
    detail: messageListenEndpointDetail,
  })
  .get(
    '/identities',
    async ({ set }) => {
      try {
        console.log('=== Starting /identities request ===');

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
          console.log('Using cached identities list');
          Object.assign(set.headers, {
            'Cache-Control': 'public, max-age=60',
          });
          return cachedIdentities.value;
        }

        // If no cached list, get all signer-* keys from Redis
        console.log('No cached identities list, checking individual signer caches');
        const signerKeys = await client.keys('signer-*');
        console.log(`Found ${signerKeys.length} cached signers`);

        if (!signerKeys.length) {
          console.log('No cached signers found');
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
        console.log('Total cached signers:', signerKeys.length);
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
