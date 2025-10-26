import type { Filter } from 'mongodb';
import { getSigners } from '../bap.js';
import { COLLECTIONS } from '../config/constants.js';
import { getDbo } from '../db.js';
import { NotFoundError } from '../middleware/errorHandler.js';
import type { Video, VideoMeta, VideoState } from '../schemas/entities/video.js';
import { fetchBapIdentityData } from '../social/queries/identity.js';
import type { BapIdentity } from '../types.js';

// Interfaces for query parameters
export interface VideosParams {
  page?: number;
  limit?: number;
  channel?: string;
  bapId?: string;
  address?: string;
  videoID?: string;
}

export interface VideoResponse {
  video: Video;
  meta?: VideoMeta;
}

export interface VideosResponse {
  page: number;
  limit: number;
  count: number;
  results: Video[];
  signers: BapIdentity[];
  meta?: VideoMeta[];
}

export interface VideoStateResponse {
  channel: string;
  states: VideoState[];
}

// Helper function to normalize video data
function normalizeVideo(video: Video): Video {
  return {
    ...video,
    tx: { h: video.tx?.h || '' },
    blk: video.blk || { i: 0, t: 0 },
    timestamp: video.timestamp || video.blk?.t || Math.floor(Date.now() / 1000),
    MAP:
      video.MAP?.map((m) => ({
        ...m,
        type: m.type || 'video',
        app: m.app || '',
      })) || [],
  };
}

// Get a single video by transaction ID
export async function getVideo(txid: string): Promise<VideoResponse> {
  const dbo = await getDbo();

  const video = await dbo
    .collection<Video>(COLLECTIONS.VIDEO)
    .findOne({ _id: txid } as Filter<Video>);

  if (!video) {
    throw new NotFoundError(`Video transaction ${txid} not found`);
  }

  // Get video metadata (views, likes, etc.)
  const meta = await getVideoMeta(txid);

  return {
    video: normalizeVideo(video),
    meta,
  };
}

// Get video metadata (aggregated data)
async function getVideoMeta(txid: string): Promise<VideoMeta> {
  const dbo = await getDbo();

  // Count likes for this video
  const likes = await dbo.collection(COLLECTIONS.LIKE).countDocuments({
    'MAP.tx': txid,
  });

  // Get reactions
  const reactions = await dbo
    .collection(COLLECTIONS.LIKE)
    .aggregate([
      { $match: { 'MAP.tx': txid, 'MAP.emoji': { $exists: true, $ne: '' } } },
      { $group: { _id: '$MAP.emoji', count: { $sum: 1 } } },
      { $project: { emoji: '$_id', count: 1, _id: 0 } },
    ])
    .toArray();

  // Count comments (replies to video)
  const comments = await dbo.collection(COLLECTIONS.POST).countDocuments({
    'MAP.tx': txid,
  });

  return {
    likes,
    comments,
    reactions: reactions as Array<{ emoji: string; count: number }>,
  };
}

// Get videos with pagination and filters
export async function getVideos({
  page = 1,
  limit = 20,
  channel,
  bapId,
  address,
  videoID,
}: VideosParams): Promise<VideosResponse> {
  const dbo = await getDbo();
  const skip = (page - 1) * limit;

  const query: Record<string, unknown> = {};

  // Add filters
  if (channel) {
    query['MAP.channel'] = channel;
  }

  if (videoID) {
    query['MAP.videoID'] = videoID;
  }

  if (address) {
    query['AIP.address'] = address;
  } else if (bapId) {
    const identity = await fetchBapIdentityData(bapId);
    if (!identity?.currentAddress) {
      throw new Error('Invalid BAP identity data');
    }
    query['AIP.address'] = { $in: identity.addresses.map((a) => a.address) };
  }

  // Execute query
  const [results, count] = await Promise.all([
    dbo
      .collection<Video>(COLLECTIONS.VIDEO)
      .find(query)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .toArray(),
    dbo.collection<Video>(COLLECTIONS.VIDEO).countDocuments(query),
  ]);

  // Get unique signer addresses
  const signerAddresses = new Set<string>();
  for (const video of results) {
    if (video.AIP) {
      for (const aip of video.AIP) {
        if (aip.address) {
          signerAddresses.add(aip.address);
        }
      }
    }
  }

  // Get BAP identities for all signers
  const signers = await getSigners([...signerAddresses]);

  // Get metadata for all videos
  const meta = await Promise.all(results.map((video) => getVideoMeta(String(video._id))));

  return {
    page,
    limit,
    count,
    results: results.map((video) => normalizeVideo(video)),
    signers,
    meta,
  };
}

// Get video states by channel (for Minerva synchronization)
export async function getVideoStatesByChannel(channel: string): Promise<VideoStateResponse> {
  const dbo = await getDbo();

  // Get latest video state for the channel
  const states = await dbo
    .collection(COLLECTIONS.VIDEO)
    .aggregate([
      {
        $match: {
          'MAP.channel': channel,
          'MAP.action': { $exists: true },
        },
      },
      {
        $sort: { timestamp: -1 },
      },
      {
        $group: {
          _id: '$MAP.videoID',
          latestState: { $first: '$$ROOT' },
        },
      },
      {
        $replaceRoot: { newRoot: '$latestState' },
      },
      {
        $project: {
          channel: '$MAP.channel',
          videoID: '$MAP.videoID',
          action: '$MAP.action',
          position: { $ifNull: ['$MAP.position', 0] },
          timestamp: 1,
          txid: '$_id',
        },
      },
    ])
    .toArray();

  return {
    channel,
    states: states as VideoState[],
  };
}

// Get video history for a specific video in a channel
export async function getVideoHistory(channel: string, videoID: string): Promise<Video[]> {
  const dbo = await getDbo();

  const history = await dbo
    .collection<Video>(COLLECTIONS.VIDEO)
    .find({
      'MAP.channel': channel,
      'MAP.videoID': videoID,
    })
    .sort({ timestamp: -1 })
    .limit(100)
    .toArray();

  return history.map((video) => normalizeVideo(video));
}

// Search videos by title or description
export async function searchVideos(searchTerm: string, limit = 20): Promise<VideosResponse> {
  const dbo = await getDbo();

  const query = {
    $or: [
      { 'MAP.title': { $regex: searchTerm, $options: 'i' } },
      { 'MAP.description': { $regex: searchTerm, $options: 'i' } },
    ],
  };

  const results = await dbo
    .collection<Video>(COLLECTIONS.VIDEO)
    .find(query)
    .sort({ timestamp: -1 })
    .limit(limit)
    .toArray();

  // Get unique signer addresses
  const signerAddresses = new Set<string>();
  for (const video of results) {
    if (video.AIP) {
      for (const aip of video.AIP) {
        if (aip.address) {
          signerAddresses.add(aip.address);
        }
      }
    }
  }

  const signers = await getSigners([...signerAddresses]);

  return {
    page: 1,
    limit,
    count: results.length,
    results: results.map((video) => normalizeVideo(video)),
    signers,
  };
}
