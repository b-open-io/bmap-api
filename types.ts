// ============================================
// CORE BLOCKCHAIN TRANSACTION TYPES
// ============================================

/**
 * Base transaction input structure
 */
export interface TransactionInput {
  i: number;
  tape: null;
  e: {
    a: string; // Address
    v: number; // Value
    i: number; // Index
    h: string; // Hash
  };
  seq: number;
}

/**
 * Base transaction output structure
 */
export interface TransactionOutput {
  i: number;
  tape: null;
  e: {
    v: number; // Value
    i: number; // Index
    a?: string; // Address (optional)
  };
}

/**
 * Block information
 */
export interface BlockInfo {
  i: number; // Block height/index
  t: number; // Block timestamp
}

/**
 * Transaction reference
 */
export interface TransactionRef {
  h: string; // Transaction hash
}

/**
 * AIP (Address Identity Protocol) signature data
 */
export interface AIPSignature {
  algorithm: string; // e.g., "BITCOIN_ECDSA"
  address: string; // Bitcoin address (normalized field)
  data: string[]; // AIP data array
  signature: string; // Base64 signature
  // Legacy fields (will be deprecated)
  algorithm_signing_component?: string; // Old field name
}

/**
 * MAP (Magic Attribute Protocol) data
 */
export interface MAPData {
  CMD?: string; // Command (e.g., "SET")
  app?: string; // Application name
  type?: string; // Type (e.g., "post", "message", "like")
  [key: string]: string | undefined; // Additional MAP fields
}

/**
 * B protocol data (Bitcoin Files) - normalized structure
 */
export interface BData {
  encoding: string; // Encoding type (e.g., "UTF-8")
  content: string; // Content data (may be empty)
  'content-type': string; // MIME type (e.g., "text/markdown")
  filename: string; // File name (may be empty)
  // Legacy fields (may still exist in old data)
  media_type?: string; // Old content type field
  Data?: Record<string, unknown>; // Old data object
}

/**
 * Base transaction structure (shared by all transaction types)
 */
export interface BaseTransaction {
  _id: string; // Transaction hash (same as tx.h)
  tx: TransactionRef;
  blk: BlockInfo;
  timestamp: number; // Unix timestamp
  AIP: AIPSignature[];
  MAP: MAPData[];
  B: BData[];
  in: TransactionInput[];
  out: TransactionOutput[];
  lock?: number; // Lock time
  SIGMA?: null; // SIGMA protocol data (usually null)
}

// ============================================
// SPECIFIC TRANSACTION TYPES
// ============================================

/**
 * Post transaction (MAP.type = "post")
 */
export interface PostTransaction extends BaseTransaction {
  MAP: (MAPData & {
    type: 'post';
    app?: string;
  })[];
}

/**
 * Message transaction (MAP.type = "message")
 */
export interface MessageTransaction extends BaseTransaction {
  MAP: (MAPData & {
    type: 'message';
    app?: string;
    bapID?: string; // Target BAP ID for direct messages
    encrypted?: string; // "true" if encrypted
    context?: string; // Message context
    channel?: string; // Channel name for public messages
    messageID?: string; // Unique message ID
  })[];
}

/**
 * Like transaction (MAP.type = "like")
 */
export interface LikeTransaction extends BaseTransaction {
  MAP: (MAPData & {
    type: 'like';
    tx?: string; // Target transaction hash
    messageID?: string; // Target message ID
    emoji?: string; // Emoji reaction
  })[];
}

/**
 * Friend transaction (MAP.type = "friend")
 */
export interface FriendTransaction extends BaseTransaction {
  MAP: (MAPData & {
    type: 'friend';
    bapID?: string; // Target BAP ID
  })[];
}

/**
 * Follow transaction (MAP.type = "follow")
 */
export interface FollowTransaction extends BaseTransaction {
  MAP: (MAPData & {
    type: 'follow';
    idKey?: string; // Target BAP ID key
  })[];
}

/**
 * Unfollow transaction (MAP.type = "unfollow")
 */
export interface UnfollowTransaction extends BaseTransaction {
  MAP: (MAPData & {
    type: 'unfollow';
    idKey?: string; // Target BAP ID key
  })[];
}

// ============================================
// BAP IDENTITY TYPES
// ============================================

/**
 * BAP Address (Bitcoin address used by BAP identity)
 */
export interface BapAddress {
  address: string;
  txId: string;
  block: number; // Block height where address was first used
}

/**
 * Identity data (JSON-LD schema.org Person)
 */
export interface IdentityData {
  '@context'?: string;
  '@type': string; // Required field
  alternateName?: string;
  description?: string;
  image?: string;
  url?: string;
  email?: string;
  paymail?: string;
  banner?: string;
  logo?: string;
  bitcoinAddress?: string;
  familyName?: string;
  givenName?: string;
  firstSeen: number; // Unix timestamp of when identity was first seen
  homeLocation?: {
    '@type'?: string;
    name?: string;
    latitude?: string;
    longitude?: string;
  };
}

/**
 * BAP Identity (complete identity record)
 */
export interface BapIdentity {
  idKey: string; // BAP identity key
  rootAddress: string; // Root Bitcoin address
  currentAddress: string; // Current active address
  addresses: BapAddress[]; // All addresses for this identity
  identity: IdentityData; // Identity data object
  identityTxId: string; // Transaction hash of identity
  block: number; // Block height
  timestamp: number; // Unix timestamp
  valid: boolean; // Whether identity is valid
  paymail?: string; // Optional paymail
  displayName?: string; // Computed display name
  icon?: string; // Profile icon URL
  firstSeen: number; // Unix timestamp of when identity was first seen
}

// ============================================
// API RESPONSE TYPES
// ============================================

/**
 * Pagination metadata
 */
export interface PaginationMeta {
  page: number;
  limit: number;
  count: number;
}

/**
 * Post metadata (likes, replies, reactions)
 */
export interface PostMeta {
  tx: string; // Transaction hash
  likes: number; // Total likes count
  reactions: Array<{
    emoji: string;
    count: number;
  }>;
  replies: number; // Total replies count
}

/**
 * Message metadata (read receipts, reactions, delivery status)
 */
export interface MessageMeta {
  tx: string; // Transaction hash
  readBy: string[]; // Array of BAP IDs who read it
  reactions: Array<{
    emoji: string;
    count: number;
  }>;
  delivered: boolean; // Delivery confirmation
  edited?: boolean; // If message was edited
  editedAt?: number; // Timestamp of last edit
}

/**
 * Posts response (for feeds, user posts, etc.)
 */
export interface PostsResponse extends PaginationMeta {
  bapID?: string; // BAP ID for user-specific feeds
  results: PostTransaction[];
  signers: BapIdentity[];
  meta: PostMeta[];
}

/**
 * Single post response
 */
export interface PostResponse {
  post: PostTransaction;
  signers: BapIdentity[];
  meta: PostMeta;
}

/**
 * Messages response
 */
export interface MessagesResponse extends PaginationMeta {
  bapID?: string;
  results: MessageTransaction[];
  signers: BapIdentity[];
  meta: MessageMeta[];
}

/**
 * Channel info
 */
export interface ChannelInfo {
  channel: string;
  creator?: string | null;
  last_message?: string | null;
  last_message_time?: number;
  messages?: number;
  public_read?: boolean;
  public_write?: boolean;
  bapId?: string;
  tx?: TransactionRef;
  timestamp?: number;
  blk?: BlockInfo;
}

/**
 * Like info with reactions
 */
export interface LikeInfo {
  tx: string; // Target transaction
  txid?: string; // Alternative field name
  likes: LikeTransaction[];
  total: number;
  signers: BapIdentity[];
  reactions: Record<
    string,
    Array<{
      emoji: string;
      bapId: string;
    }>
  >;
}

/**
 * Likes response (for /post/:txid/like, /bap/:bapId/like)
 */
export interface LikesResponse extends PaginationMeta {
  bapID?: string; // BAP ID for user-specific likes
  results: LikeTransaction[];
  signers: BapIdentity[];
}

/**
 * Friend/relationship data
 */
export interface Friend {
  bapId: string;
  name?: string;
  icon?: string;
  mePublicKey?: string;
  themPublicKey?: string;
  txids?: string[];
}

export interface FriendData {
  friends: Friend[];
  incoming: Friend[];
  outgoing: Friend[];
}

// ============================================
// QUERY PARAMETERS
// ============================================

export interface PostsParams {
  bapId?: string;
  address?: string;
  feed?: boolean;
  page: number;
  limit: number;
}

export interface RepliesParams {
  txid: string;
  page: number;
  limit: number;
}

export interface SearchParams {
  q: string;
  limit: number;
  offset: number;
}

export interface DirectMessageParams {
  bapId: string;
  targetBapId?: string;
  page: number;
  limit: number;
}

export interface ChannelMessageParams {
  channelId: string;
  page: number;
  limit: number;
}

export interface LikesQueryRequest {
  txids?: string[];
  messageIds?: string[];
}

// ============================================
// UTILITY TYPES
// ============================================

export enum Timeframe {
  Day = '24h',
  Week = 'week',
  Month = 'month',
  Year = 'year',
  All = 'all',
}

/**
 * Generic API response wrapper
 */
export interface ApiResponse<T> {
  status: string;
  result: T;
  error?: string;
}

/**
 * Error response
 */
export interface ErrorResponse {
  code: string;
  message: string;
}
