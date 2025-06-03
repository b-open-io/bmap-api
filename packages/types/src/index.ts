// Re-export all types from the core types file
export * from './core';

// Export version info
export const VERSION = '0.0.5';
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
