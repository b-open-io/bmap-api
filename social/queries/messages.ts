import { resolveSigners } from '../../bap.js';
import type { CacheValue } from '../../cache.js';
import { client, readFromRedis, saveToRedis } from '../../cache.js';
import { getDbo } from '../../db.js';
import type { BapIdentity } from '../../types.js';
import type { ChannelMessageResponse, BaseMessage as Message } from '../schemas.js';

// Helper function to merge new signers into cache
export async function updateSignerCache(newSigners: BapIdentity[]): Promise<void> {
  for (const signer of newSigners) {
    const signerKey = `signer-${signer.currentAddress}`;
    await saveToRedis<CacheValue>(signerKey, {
      type: 'signer',
      value: signer,
    });
  }
  // Clear the identities cache to force a refresh with new signers
  await client.del('identities');
}

export async function getChannelMessages(params: {
  channelId: string;
  page: number;
  limit: number;
}): Promise<ChannelMessageResponse> {
  const { channelId, page, limit } = params;
  const skip = (page - 1) * limit;
  const decodedChannelId = decodeURIComponent(channelId);

  const cacheKey = `messages:${decodedChannelId}:${page}:${limit}`;
  const cached = await readFromRedis<CacheValue>(cacheKey);

  if (cached?.type === 'messages') {
    console.log('Cache hit for messages:', cacheKey);
    // Type guard to ensure we have the right cached value type
    if ('page' in cached.value && 'results' in cached.value) {
      return {
        ...cached.value,
        channel: channelId,
        signers: cached.value.signers || [],
      };
    }
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
    txid: msg.tx?.h || '', // Include txid for frontend compatibility
    blk: { i: msg.blk?.i || 0, t: msg.blk?.t || 0 },
    MAP: msg.MAP?.map((m) => ({
      app: m.app || '',
      type: m.type || '',
      channel: m.channel || '',
      paymail: m.paymail || '',
      context: m.context || 'channel',
      bapID: m.bapID || '',
    })) || [
      {
        app: '',
        type: '',
        channel: '',
        paymail: '',
      },
    ],
    B: msg.B?.map(
      (b: {
        encoding?: string;
        content?: string;
        'content-type'?: string;
        filename?: string;
      }) => ({
        encoding: b?.encoding || '',
        content: b?.content || '',
        'content-type': b?.['content-type'] || 'text/plain',
        filename: b?.filename || '',
      })
    ) || [
      {
        encoding: '',
        content: '',
        'content-type': '',
        filename: '',
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
      s.identity && typeof s.identity === 'object'
        ? s.identity
        : { '@type': 'Person', firstSeen: s.firstSeen || s.timestamp || 0 },
    firstSeen: s.firstSeen || s.timestamp || 0,
  }));

  const response: ChannelMessageResponse = {
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

  return response;
}
