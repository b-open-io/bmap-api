export type { Static } from '@sinclair/typebox';
export interface FriendResponse {
  bapId: string;
  displayName?: string;
  avatar?: string;
  following: boolean;
  follower: boolean;
  friend: boolean;
  blocked: boolean;
  muted: boolean;
}
export interface AutofillResponse {
  bapId: string;
  displayName?: string;
  avatar?: string;
}
export interface ChannelMessageResponse {
  channel: string;
  page: number;
  limit: number;
  count: number;
  results: Message[];
  signers: unknown[];
}
export interface DMResponse {
  messages: Message[];
  lastMessage?: Message;
  signers?: unknown[];
}
export interface PostResponse {
  _id: string;
  MAP: Array<{
    app?: string;
    type?: string;
    [key: string]: unknown;
  }>;
  B?: {
    content?: string;
    [key: string]: unknown;
  };
  tx: {
    h: string;
  };
  blk?: {
    i: number;
    t: number;
  };
  timestamp?: number;
  meta?: {
    likes?: number;
    replies?: number;
    reposts?: number;
    signers?: unknown[];
  };
}
export interface PostsResponse {
  posts: PostResponse[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}
export interface LikeResponse {
  success: boolean;
  txid?: string;
  message?: string;
}
export interface IdentityResponse {
  idKey: string;
  paymail: string | null;
  displayName: string;
  icon: string | null;
}
export interface ChannelResponse {
  channel: string;
  creator?: string | null;
  last_message?: string | null;
  last_message_time?: number;
  messages?: number;
  public_read?: boolean;
  public_write?: boolean;
}
export interface NetworkOverviewResponse {
  totalTransactions: number;
  totalUsers: number;
  totalChannels: number;
  activeUsers24h: number;
  activeUsers7d: number;
  activeUsers30d: number;
  transactionsToday: number;
  transactions7d: number;
  transactions30d: number;
  avgTransactionsPerUser: number;
  networkHealth: number;
  peakTransactionsHour: number;
  peakUsersHour: number;
  topChannels: string[];
}
export interface TrendingChannelsResponse {
  channels: Array<{
    channel: string;
    creator?: string;
    messageCount: number;
    userCount: number;
    avgMessagesPerUser: number;
    lastActivity: number;
    growthRate: number;
  }>;
}
export interface NetworkHealthResponse {
  overallHealth: number;
  transactionHealth: number;
  userActivityHealth: number;
  channelActivityHealth: number;
  networkStabilityHealth: number;
  recommendations: string[];
}
export interface NetworkActivityResponse {
  period: string;
  data: Array<{
    timestamp: number;
    transactions: number;
    users: number;
    channels: number;
    messages: number;
  }>;
}
export interface NetworkGrowthResponse {
  period: string;
  data: Array<{
    timestamp: number;
    users: number;
    transactions: number;
    channels: number;
  }>;
}
export interface AdminStatsResponse {
  totalUsers: number;
  totalTransactions: number;
  totalChannels: number;
  totalMessages: number;
  storageUsed: number;
  bandwidthUsed: number;
  errorRate: number;
  uptime: number;
  avgResponseTime: number;
  peakConcurrentUsers: number;
  cacheHitRate: number;
  databaseConnections: number;
}
export interface TrendingUsersResponse {
  users: Array<{
    bapId: string;
    displayName?: string;
    avatar?: string;
    messageCount: number;
    likeCount: number;
    followerCount: number;
    activityScore: number;
    growthRate: number;
  }>;
}
export interface UserMetricsResponse {
  bapId: string;
  messageCount: number;
  likeCount: number;
  followerCount: number;
  followingCount: number;
  channelsCreated: number;
  avgMessagesPerDay: number;
  joinDate: number;
  lastActivity: number;
  activityScore: number;
}
export interface ContentAnalyticsResponse {
  totalContent: number;
  contentToday: number;
  avgContentPerUser: number;
  topContentTypes: Array<{
    type: string;
    count: number;
    percentage: number;
  }>;
  contentGrowthRate: number;
  avgContentLength: number;
  engagementRate: number;
}
export interface TrendingContentResponse {
  content: Array<{
    txId: string;
    type: string;
    author: string;
    content: string;
    timestamp: number;
    likes: number;
    replies: number;
    shares: number;
    score: number;
  }>;
}
export interface ChartResponse {
  labels: number[];
  values: number[];
  range: number[];
}
export interface BmapTx {
  tx: {
    h: string;
  };
  in: Array<{
    i: number;
    tape: Array<{
      cell: Array<{
        s?: string;
        h?: string;
        b?: string;
      }>;
    }>;
  }>;
  out: Array<{
    i: number;
    tape: Array<{
      cell: Array<{
        s?: string;
        h?: string;
        b?: string;
      }>;
    }>;
  }>;
  timestamp?: number;
  blk?: {
    i: number;
    t: number;
  };
}
export interface BapIdentity {
  idKey: string;
  rootAddress: string;
  currentAddress: string;
  identity?: unknown;
  valid: boolean;
}
export interface Post {
  txId: string;
  author: string;
  content: string;
  timestamp: number;
  likes?: number;
}
export interface Message {
  txId: string;
  author: string;
  content: string;
  timestamp: number;
  channel?: string;
}
export interface Friend {
  bapId: string;
  displayName?: string;
  avatar?: string;
}
export interface Like {
  txId: string;
  author: string;
  target: string;
  emoji?: string;
  timestamp: number;
}
export interface PaginationParams {
  page?: string;
  limit?: string;
}
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
export interface ErrorResponse {
  success: false;
  error: string;
  code?: string;
  details?: unknown;
}
export interface SuccessResponse<T = unknown> {
  success: true;
  data: T;
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
    hasMore?: boolean;
  };
}
export interface SearchParams {
  q: string;
  page?: string;
  limit?: string;
}
export interface BapIdParams {
  bapId: string;
}
export interface TxIdParams {
  txId: string;
}
export interface AddressParams {
  address: string;
}
export interface ChannelParams {
  channel: string;
}
export interface ChartParams {
  name?: string;
}
export interface ChartQuery {
  timeframe?: string;
}
//# sourceMappingURL=index.d.ts.map
