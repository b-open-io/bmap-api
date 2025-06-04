/**
 * Centralized route path constants for BMAP API
 * This ensures consistency across the codebase and makes route changes easier
 */

// Social routes
export const SOCIAL_ROUTES = {
  // Channels
  CHANNELS: '/channels',
  CHANNEL_MESSAGES: '/channels/:channelId/messages',

  // Search
  AUTOFILL: '/autofill',
  IDENTITY_SEARCH: '/identity/search',
  POST_SEARCH: '/post/search',

  // Identities
  IDENTITIES: '/identities',
  IDENTITY_BY_BAP_ID: '/identity/:bapId',

  // Posts
  POSTS: '/posts',
  POST_BY_BAP_ID: '/post/bap/:bapId',
  POST_LIKES: '/post/:txId/likes',
  POST_THREAD: '/post/:txId/thread',

  // Social relationships
  FRIEND: '/friend/:bapId',
  LIKE: '/like',

  // Messages
  MESSAGES: '/messages/:bapId',
  CHANNEL_LISTEN: '/channels/:channelId/listen',
  MESSAGE_LISTEN: '/message/listen/:bapId',

  // DMs
  DM_HISTORY: '/dm/:targetBapId',
  DM_CONVERSATIONS: '/dm/conversations/:bapId',

  // Analytics
  USER_STATS: '/user/:bapId/stats',
  FEED: '/feed/:bapId',
} as const;

// Analytics routes
export const ANALYTICS_ROUTES = {
  // Network analytics
  NETWORK_OVERVIEW: '/network/overview',
  NETWORK_ACTIVITY: '/network/activity',
  NETWORK_GROWTH: '/network/growth',
  NETWORK_CHANNELS: '/network/channels',
  NETWORK_USERS: '/network/users',

  // Content analytics
  CONTENT_ANALYTICS: '/content/analytics',
  TRENDING_CHANNELS: '/trending/channels',
  TRENDING_POSTS: '/trending/posts',

  // User analytics
  USER_METRICS: '/user/:userId/metrics',
  USER_ACTIVITY: '/user/:userId/activity',

  // Admin analytics
  ADMIN_STATS: '/admin/stats',

  // Export and streaming
  EXPORT: '/export',
  ALERTS_CHECK: '/alerts/check',
  STREAM: '/stream/:stream',
} as const;

// Health routes
export const HEALTH_ROUTES = {
  STATUS: '/status',
} as const;

// Core query routes
export const QUERY_ROUTES = {
  // MongoDB queries
  QUERY: '/q/:collectionName/:base64Query',
  QUERY_SHORT: '/s/:collectionName?/:base64Query',

  // SSE streaming
  SSE_QUERY: '/s/:collectionName/:base64Query',
} as const;

// Transaction routes
export const TRANSACTION_ROUTES = {
  TRANSACTION_BY_ID: '/tx/:tx/:format?',
  INGEST: '/ingest',
} as const;

// Chart routes
export const CHART_ROUTES = {
  CHART_DATA: '/chart-data/:name?',
} as const;

// Combined route object for easy access
export const API_ROUTES = {
  SOCIAL: SOCIAL_ROUTES,
  ANALYTICS: ANALYTICS_ROUTES,
  HEALTH: HEALTH_ROUTES,
  QUERY: QUERY_ROUTES,
  TRANSACTION: TRANSACTION_ROUTES,
  CHART: CHART_ROUTES,
} as const;

// Route prefixes
export const ROUTE_PREFIXES = {
  SOCIAL: '/social',
  ANALYTICS: '/analytics',
  HEALTH: '/health',
  ROOT: '',
} as const;

// Helper function to build full paths
export function buildRoute(prefix: string, route: string): string {
  return `${prefix}${route}`;
}

// Full path builders
export const FULL_ROUTES = {
  // Social routes with prefix
  SOCIAL: Object.fromEntries(
    Object.entries(SOCIAL_ROUTES).map(([key, path]) => [
      key,
      buildRoute(ROUTE_PREFIXES.SOCIAL, path),
    ])
  ),

  // Analytics routes with prefix
  ANALYTICS: Object.fromEntries(
    Object.entries(ANALYTICS_ROUTES).map(([key, path]) => [
      key,
      buildRoute(ROUTE_PREFIXES.ANALYTICS, path),
    ])
  ),

  // Health routes with prefix
  HEALTH: Object.fromEntries(
    Object.entries(HEALTH_ROUTES).map(([key, path]) => [
      key,
      buildRoute(ROUTE_PREFIXES.HEALTH, path),
    ])
  ),

  // Root level routes (no prefix)
  QUERY: QUERY_ROUTES,
  TRANSACTION: TRANSACTION_ROUTES,
  CHART: CHART_ROUTES,
} as const;

// Route groups are already exported above, no need to re-export
