import type { CacheValue } from '../../cache.js';
import { readFromRedis, saveToRedis } from '../../cache.js';
import { getDbo } from '../../db.js';
import type { ChannelInfo } from '../schemas.js';

export async function getChannels(): Promise<ChannelInfo[]> {
  try {
    const cacheKey = 'channels';
    const cached = await readFromRedis<CacheValue>(cacheKey);

    if (cached?.type === 'channels') {
      return cached.value;
    }
    const db = await getDbo();

    try {
      const pipeline = [
        {
          $match: {
            'MAP.channel': { $exists: true, $ne: '' },
          },
        },
        {
          $unwind: '$MAP',
        },
        {
          $unwind: '$B',
        },
        {
          $group: {
            _id: '$MAP.channel',
            channel: { $first: '$MAP.channel' },
            creator: { $first: { $ifNull: ['$MAP.paymail', null] } },
            // last_message: { $last: { $ifNull: ['$B.Data.utf8', null] } },
            last_message: { $last: { $ifNull: ['$B.content', null] } },
            last_message_time: { $max: '$blk.t' },
            messages: { $sum: 1 },
          },
        },
        {
          $sort: { last_message_time: -1 },
        },
        {
          $limit: 100,
        },
      ];

      const results = await db.collection('message').aggregate(pipeline).toArray();

      const channels = results.map((r) => ({
        channel: r.channel,
        creator: r.creator || null,
        last_message: r.last_message || null,
        last_message_time: r.last_message_time,
        messages: r.messages,
      }));

      await saveToRedis<CacheValue>(cacheKey, {
        type: 'channels',
        value: channels,
      });

      return channels;
    } catch (dbError) {
      console.error('MongoDB operation failed:', dbError);
      throw new Error('Failed to fetch channels');
    }
  } catch (error) {
    console.error('getChannels error:', error);
    throw error;
  }
}
