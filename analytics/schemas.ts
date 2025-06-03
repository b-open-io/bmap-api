import { type Static, Type as t } from '@sinclair/typebox';

// Request types
export const NetworkOverviewParams = t.Object({});

export const TrendingChannelsParams = t.Object({
  timeframe: t.Optional(t.Union([t.Literal('24h'), t.Literal('7d'), t.Literal('30d')])),
  limit: t.Optional(t.Number({ minimum: 1, maximum: 100 })),
});

export const NetworkActivityParams = t.Object({
  limit: t.Optional(t.Number({ minimum: 1, maximum: 100 })),
  type: t.Optional(
    t.Union([t.Literal('message'), t.Literal('post'), t.Literal('friend'), t.Literal('all')])
  ),
});

export const NetworkGrowthParams = t.Object({
  timeframe: t.Optional(
    t.Union([t.Literal('7d'), t.Literal('30d'), t.Literal('90d'), t.Literal('1y')])
  ),
  metric: t.Optional(
    t.Union([
      t.Literal('users'),
      t.Literal('messages'),
      t.Literal('channels'),
      t.Literal('transactions'),
    ])
  ),
});

export const AdminStatsParams = t.Object({});

export const TrendingUsersParams = t.Object({
  timeframe: t.Optional(t.Union([t.Literal('24h'), t.Literal('7d'), t.Literal('30d')])),
  limit: t.Optional(t.Number({ minimum: 1, maximum: 100 })),
  metric: t.Optional(
    t.Union([t.Literal('messages'), t.Literal('followers'), t.Literal('engagement')])
  ),
});

export const UserMetricsParams = t.Object({
  userId: t.String(),
  timeframe: t.Optional(t.Union([t.Literal('7d'), t.Literal('30d'), t.Literal('90d')])),
});

export const ContentAnalyticsParams = t.Object({
  type: t.Optional(t.Union([t.Literal('posts'), t.Literal('messages'), t.Literal('media')])),
  timeframe: t.Optional(t.Union([t.Literal('24h'), t.Literal('7d'), t.Literal('30d')])),
  limit: t.Optional(t.Number({ minimum: 1, maximum: 100 })),
});

export const TrendingContentParams = t.Object({
  type: t.Optional(t.Union([t.Literal('posts'), t.Literal('messages'), t.Literal('media')])),
  timeframe: t.Optional(t.Union([t.Literal('24h'), t.Literal('7d'), t.Literal('30d')])),
  limit: t.Optional(t.Number({ minimum: 1, maximum: 50 })),
  metric: t.Optional(t.Union([t.Literal('views'), t.Literal('likes'), t.Literal('engagement')])),
});

// Response types
export const NetworkOverviewResponse = t.Object({
  totalUsers: t.Number(),
  activeUsers24h: t.Number(),
  activeUsers7d: t.Number(),
  totalMessages: t.Number(),
  totalChannels: t.Number(),
  totalTransactions: t.Number(),
  totalPosts: t.Number(),
  avgConnectionsPerUser: t.Number(),
  networkGrowthRate: t.Object({
    daily: t.String(),
    weekly: t.String(),
    monthly: t.String(),
  }),
  lastUpdated: t.String({ format: 'date-time' }),
});

export const TrendingChannelItem = t.Object({
  channel: t.String(),
  creator: t.Union([t.String(), t.Null()]),
  metrics: t.Object({
    messages: t.Number(),
    activeUsers: t.Number(),
    messagesPerHour: t.Number(),
    engagementRate: t.Number(),
  }),
  recentActivity: t.Object({
    lastMessage: t.String({ format: 'date-time' }),
    messagesInTimeframe: t.Number(),
  }),
  trendScore: t.Number(),
});

export const TrendingChannelsResponse = t.Object({
  timeframe: t.String(),
  channels: t.Array(TrendingChannelItem),
});

export const NetworkHealthResponse = t.Object({
  status: t.Union([t.Literal('healthy'), t.Literal('degraded'), t.Literal('critical')]),
  metrics: t.Object({
    apiResponseTime: t.Number(),
    transactionThroughput: t.Number(),
    errorRate: t.Number(),
    activeConnections: t.Number(),
  }),
  services: t.Object({
    database: t.Union([t.Literal('healthy'), t.Literal('warning'), t.Literal('error')]),
    redis: t.Union([t.Literal('healthy'), t.Literal('warning'), t.Literal('error')]),
    blockchain: t.Union([t.Literal('healthy'), t.Literal('warning'), t.Literal('error')]),
  }),
  blockchain: t.Object({
    currentBlock: t.Number(),
    lastUpdated: t.String({ format: 'date-time' }),
  }),
  lastChecked: t.String({ format: 'date-time' }),
});

export const ActivityItem = t.Object({
  id: t.String(),
  type: t.Union([
    t.Literal('message'),
    t.Literal('post'),
    t.Literal('friend'),
    t.Literal('transaction'),
  ]),
  timestamp: t.String({ format: 'date-time' }),
  userAddress: t.Union([t.String(), t.Null()]),
  bapId: t.Union([t.String(), t.Null()]),
  content: t.Union([t.String(), t.Null()]),
  txid: t.Union([t.String(), t.Null()]),
  channel: t.Union([t.String(), t.Null()]),
  metadata: t.Record(t.String(), t.Unknown()),
});

export const NetworkActivityResponse = t.Object({
  activities: t.Array(ActivityItem),
  pagination: t.Object({
    limit: t.Number(),
    total: t.Number(),
  }),
});

export const GrowthDataPoint = t.Object({
  date: t.String(),
  count: t.Number(),
  new: t.Number(),
});

export const NetworkGrowthResponse = t.Object({
  timeframe: t.String(),
  metric: t.String(),
  data: t.Array(GrowthDataPoint),
});

export const AdminStatsResponse = t.Object({
  userStats: t.Object({
    total: t.Number(),
    active24h: t.Number(),
    newRegistrations24h: t.Number(),
    suspendedUsers: t.Number(),
  }),
  contentStats: t.Object({
    totalPosts: t.Number(),
    posts24h: t.Number(),
    totalMessages: t.Number(),
    messages24h: t.Number(),
    flaggedContent: t.Number(),
    deletedContent: t.Number(),
  }),
  systemHealth: t.Object({
    uptime: t.String(),
    avgResponseTime: t.Number(),
    errorRate: t.Number(),
  }),
});

export const TrendingUserItem = t.Object({
  userId: t.String(),
  address: t.Union([t.String(), t.Null()]),
  bapId: t.Union([t.String(), t.Null()]),
  paymail: t.Union([t.String(), t.Null()]),
  displayName: t.Union([t.String(), t.Null()]),
  metrics: t.Object({
    messages: t.Number(),
    followers: t.Number(),
    posts: t.Number(),
    channels: t.Number(),
    engagement: t.Number(),
  }),
  recentActivity: t.Object({
    lastMessage: t.Union([t.String({ format: 'date-time' }), t.Null()]),
    messagesInTimeframe: t.Number(),
    channelsActive: t.Number(),
  }),
  trendScore: t.Number(),
});

export const TrendingUsersResponse = t.Object({
  timeframe: t.String(),
  metric: t.String(),
  users: t.Array(TrendingUserItem),
});

export const UserMetricsResponse = t.Object({
  userId: t.String(),
  timeframe: t.String(),
  identity: t.Object({
    address: t.Union([t.String(), t.Null()]),
    bapId: t.Union([t.String(), t.Null()]),
    paymail: t.Union([t.String(), t.Null()]),
    displayName: t.Union([t.String(), t.Null()]),
  }),
  activity: t.Object({
    totalMessages: t.Number(),
    totalPosts: t.Number(),
    channelsActive: t.Number(),
    avgMessagesPerDay: t.Number(),
  }),
  social: t.Object({
    followers: t.Number(),
    following: t.Number(),
    mutualConnections: t.Number(),
  }),
  engagement: t.Object({
    repliesReceived: t.Number(),
    likesReceived: t.Number(),
    channelParticipation: t.Number(),
    engagementRate: t.Number(),
  }),
  trends: t.Object({
    messagesGrowth: t.String(),
    followersGrowth: t.String(),
    engagementGrowth: t.String(),
  }),
});

export const ContentAnalyticsResponse = t.Object({
  timeframe: t.String(),
  type: t.String(),
  overview: t.Object({
    totalContent: t.Number(),
    totalViews: t.Number(),
    totalLikes: t.Number(),
    avgEngagement: t.Number(),
  }),
  topContent: t.Array(
    t.Object({
      contentId: t.String(),
      type: t.String(),
      creator: t.Union([t.String(), t.Null()]),
      title: t.Union([t.String(), t.Null()]),
      views: t.Number(),
      likes: t.Number(),
      engagement: t.Number(),
      timestamp: t.Number(),
    })
  ),
  trends: t.Object({
    dailyGrowth: t.Number(),
    weeklyGrowth: t.Number(),
    popularTags: t.Array(t.String()),
  }),
});

export const TrendingContentResponse = t.Object({
  timeframe: t.String(),
  type: t.String(),
  metric: t.String(),
  content: t.Array(
    t.Object({
      contentId: t.String(),
      type: t.String(),
      creator: t.Union([t.String(), t.Null()]),
      title: t.Union([t.String(), t.Null()]),
      description: t.Union([t.String(), t.Null()]),
      metrics: t.Object({
        views: t.Number(),
        likes: t.Number(),
        comments: t.Number(),
        shares: t.Number(),
        engagement: t.Number(),
      }),
      trendScore: t.Number(),
      timestamp: t.Number(),
      tags: t.Array(t.String()),
    })
  ),
});

// TypeScript types
export type NetworkOverviewParams = Static<typeof NetworkOverviewParams>;
export type TrendingChannelsParams = Static<typeof TrendingChannelsParams>;
export type NetworkActivityParams = Static<typeof NetworkActivityParams>;
export type NetworkGrowthParams = Static<typeof NetworkGrowthParams>;
export type AdminStatsParams = Static<typeof AdminStatsParams>;
export type TrendingUsersParams = Static<typeof TrendingUsersParams>;
export type UserMetricsParams = Static<typeof UserMetricsParams>;
export type ContentAnalyticsParams = Static<typeof ContentAnalyticsParams>;
export type TrendingContentParams = Static<typeof TrendingContentParams>;

export type NetworkOverviewResponse = Static<typeof NetworkOverviewResponse>;
export type TrendingChannelsResponse = Static<typeof TrendingChannelsResponse>;
export type NetworkHealthResponse = Static<typeof NetworkHealthResponse>;
export type NetworkActivityResponse = Static<typeof NetworkActivityResponse>;
export type NetworkGrowthResponse = Static<typeof NetworkGrowthResponse>;
export type AdminStatsResponse = Static<typeof AdminStatsResponse>;
export type TrendingUsersResponse = Static<typeof TrendingUsersResponse>;
export type UserMetricsResponse = Static<typeof UserMetricsResponse>;
export type ContentAnalyticsResponse = Static<typeof ContentAnalyticsResponse>;
export type TrendingContentResponse = Static<typeof TrendingContentResponse>;
export type ActivityItem = Static<typeof ActivityItem>;
export type TrendingChannelItem = Static<typeof TrendingChannelItem>;
export type TrendingUserItem = Static<typeof TrendingUserItem>;
export type GrowthDataPoint = Static<typeof GrowthDataPoint>;

// Phase 5: WebSocket Streaming Schemas
export const StreamSubscriptionParams = t.Object({
  stream: t.Union([
    t.Literal('network-activity'),
    t.Literal('trending-channels'),
    t.Literal('user-metrics'),
    t.Literal('content-analytics'),
  ]),
  filters: t.Optional(
    t.Object({
      timeframe: t.Optional(t.String()),
      type: t.Optional(t.String()),
      limit: t.Optional(t.Number({ minimum: 1, maximum: 100 })),
    })
  ),
});

export const StreamMessage = t.Object({
  type: t.Union([
    t.Literal('subscription-ack'),
    t.Literal('data-update'),
    t.Literal('error'),
    t.Literal('heartbeat'),
  ]),
  stream: t.Optional(t.String()),
  timestamp: t.String({ format: 'date-time' }),
  data: t.Optional(t.Unknown()),
  error: t.Optional(t.String()),
});

export const ExportParams = t.Object({
  endpoint: t.String(),
  format: t.Union([t.Literal('csv'), t.Literal('json'), t.Literal('xlsx')]),
  filters: t.Optional(t.Object({})),
});

export const AlertConfig = t.Object({
  id: t.String(),
  name: t.String(),
  metric: t.String(),
  threshold: t.Number(),
  condition: t.Union([t.Literal('above'), t.Literal('below')]),
  enabled: t.Boolean(),
  endpoints: t.Array(t.String()),
});

export const DashboardConfig = t.Object({
  id: t.String(),
  name: t.String(),
  layout: t.Array(
    t.Object({
      widget: t.String(),
      position: t.Object({
        x: t.Number(),
        y: t.Number(),
        w: t.Number(),
        h: t.Number(),
      }),
      config: t.Object({}),
    })
  ),
  refreshInterval: t.Optional(t.Number({ minimum: 5, maximum: 300 })),
});

// TypeScript types for Phase 5
export type StreamSubscriptionParams = Static<typeof StreamSubscriptionParams>;
export type StreamMessage = Static<typeof StreamMessage>;
export type ExportParams = Static<typeof ExportParams>;
export type AlertConfig = Static<typeof AlertConfig>;
export type DashboardConfig = Static<typeof DashboardConfig>;
