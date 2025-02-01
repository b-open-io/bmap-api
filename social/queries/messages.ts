import type { BapIdentity } from '../../bap.js';
import { getBAPIdByAddress } from '../../bap.js';
import type { CacheValue } from '../../cache.js';
import { client, readFromRedis, saveToRedis } from '../../cache.js';
import { getDbo } from '../../db.js';
import type { ChannelMessage, Message } from '../swagger/messages.js';

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

// Helper function to resolve signers from messages
export async function resolveSigners(messages: Message[]): Promise<BapIdentity[]> {
  const signerAddresses = new Set<string>();

  for (const msg of messages) {
    if (msg.AIP && Array.isArray(msg.AIP)) {
      for (const aip of msg.AIP) {
        const address = aip.algorithm_signing_component || aip.address;
        if (address) {
          signerAddresses.add(address);
        }
      }
    }
  }

  const signers = await Promise.all(
    Array.from(signerAddresses).map(async (address) => {
      try {
        const identity = await getBAPIdByAddress(address);
        if (identity) {
          // Update the signer cache with this identity
          const signerKey = `signer-${address}`;
          await saveToRedis<CacheValue>(signerKey, {
            type: 'signer',
            value: identity,
          });
          return identity;
        }
      } catch (error) {
        console.error(`Failed to resolve signer for address ${address}:`, error);
      }
      return null;
    })
  );

  const validSigners = signers.filter((s): s is BapIdentity => s !== null);

  // Update the cache with new signers
  await updateSignerCache(validSigners);

  return validSigners;
}

export async function getChannelMessages(params: {
  channelId: string;
  page: number;
  limit: number;
}): Promise<ChannelMessage> {
  const { channelId, page, limit } = params;
  const skip = (page - 1) * limit;
  const decodedChannelId = decodeURIComponent(channelId);

  const cacheKey = `messages:${decodedChannelId}:${page}:${limit}`;
  const cached = await readFromRedis<CacheValue>(cacheKey);

  if (cached?.type === 'messages') {
    console.log('Cache hit for messages:', cacheKey);
    return {
      ...cached.value,
      channel: channelId,
      signers: cached.value.signers || [],
    };
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
    identity: typeof s.identity === 'string' ? s.identity : JSON.stringify(s.identity) || '',
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

  return response;
}
