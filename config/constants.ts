// API Configuration Constants

// Server Configuration
export const API_PORT = process.env.PORT ? Number.parseInt(process.env.PORT) : 3055;
export const API_HOST = process.env.HOST || '127.0.0.1';

// Pagination Defaults
export const DEFAULT_PAGE_SIZE = 100;
export const MAX_PAGE_SIZE = 1000;
export const DEFAULT_PAGE = 1;

// Cache Configuration
export const CACHE_TTL = {
  DEFAULT: 3600, // 1 hour
  SHORT: 300, // 5 minutes
  MEDIUM: 900, // 15 minutes
  LONG: 86400, // 24 hours
  BLOCK_HEIGHT: 60, // 1 minute for block height
  AUTOFILL: 900, // 15 minutes for autofill
} as const;

// External API URLs
export const EXTERNAL_APIS = {
  BAP: 'https://api.sigmaidentity.com/api/v1/',
  JUNGLE_BUS: 'junglebus.gorillapool.io',
} as const;

// Database Collections
export const COLLECTIONS = {
  // Transaction collections
  CONFIRMED: 'c',
  UNCONFIRMED: 'u',

  // Social collections
  FRIEND: 'friend',
  UNFRIEND: 'unfriend',
  FOLLOW: 'follow',
  UNFOLLOW: 'unfollow',
  LIKE: 'like',
  POST: 'post',
  MESSAGE: 'message',
  PIN_CHANNEL: 'pin_channel',

  // BAP collections
  IDENTITIES: 'identities',
} as const;

// Protocol Configuration
export const PROTOCOL_START_BLOCK = 750000;
// export const PROTOCOL_START_BLOCK = 887888;

// Query Limits
export const QUERY_LIMITS = {
  MAX_AGGREGATION_DOCS: 10000,
  MAX_SEARCH_RESULTS: 100,
  CHUNK_SIZE: 50, // For batch processing
} as const;

// Error Messages
export const ERROR_MESSAGES = {
  INVALID_PAGE: 'Page number must be a positive integer',
  INVALID_LIMIT: `Limit must be between 1 and ${MAX_PAGE_SIZE}`,
  INVALID_QUERY: 'Invalid query parameter',
  INVALID_BAP_ID: 'Invalid BAP identity data',
  NOT_FOUND: 'Resource not found',
  INTERNAL_ERROR: 'Internal server error',
  REDIS_ERROR: 'Cache service unavailable',
  DB_ERROR: 'Database error',
} as const;

// HTTP Status Codes (for consistency)
export const HTTP_STATUS = {
  OK: 200,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INTERNAL_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

// Log Levels
export const LOG_LEVELS = {
  DEBUG: 'DEBUG',
  INFO: 'INFO',
  WARN: 'WARN',
  ERROR: 'ERROR',
} as const;
