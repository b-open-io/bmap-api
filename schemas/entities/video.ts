/**
 * Video entity representing a video transaction in the blockchain
 * Used by Minerva and other video platforms
 */
export interface Video {
  _id: string; // Transaction ID
  tx: {
    h: string; // Transaction hash
  };
  blk?: {
    i: number; // Block index/height
    t: number; // Block timestamp
  };
  timestamp?: number; // Transaction timestamp

  // MAP Protocol fields
  MAP: Array<{
    app?: string; // e.g., 'minerva'
    type?: string; // 'video'
    videoID?: string; // YouTube or other platform video ID
    title?: string; // Video title
    description?: string; // Video description
    channel?: string; // Channel/category
    duration?: number; // Duration in seconds
    action?: string; // play, pause, stop, seek
    position?: number; // Current playback position in seconds
    [key: string]: unknown;
  }>;

  // AIP (Author Identity Protocol)
  AIP?: Array<{
    algorithm?: string;
    address?: string;
    signature?: string;
    [key: string]: unknown;
  }>;

  // B Protocol (Binary data)
  B?: Array<{
    content?: string;
    encoding?: string;
    'content-type'?: string;
    filename?: string;
    [key: string]: unknown;
  }>;

  // BAP (Bitcoin Attestation Protocol)
  BAP?: Array<{
    type?: string;
    address?: string;
    [key: string]: unknown;
  }>;

  // Additional fields for query optimization
  'AIP.address'?: string | string[]; // Denormalized for faster queries
}

/**
 * Video metadata for aggregated queries
 */
export interface VideoMeta {
  views?: number;
  likes?: number;
  comments?: number;
  lastPlayed?: number;
  reactions?: Array<{
    emoji: string;
    count: number;
  }>;
}

/**
 * Video state for tracking playback across channels
 */
export interface VideoState {
  channel: string;
  videoID: string;
  action: string;
  position: number;
  timestamp: number;
  txid: string;
}
