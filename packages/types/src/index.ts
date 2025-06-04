// Re-export all types from the core types file
export * from './core.js';

// Export version info (read from package.json - single source of truth)
import packageJson from '../package.json' with { type: 'json' };
export const VERSION = packageJson.version;
export const API_VERSION = 'v1';

// Export commonly used utility types
export type ApiSuccessResponse<T> = {
  status: 'success';
  data: T;
};

export type ApiErrorResponse = {
  status: 'error';
  error: string;
  code?: string;
};

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;
