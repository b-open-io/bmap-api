// Common utility types used across the BMAP API

export interface PaginationParams {
  limit?: number;
  offset?: number;
  page?: number;
}

export interface PaginationResponse {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface ErrorResponse {
  error: string;
  message: string;
  statusCode: number;
  timestamp: string;
}

export interface SuccessResponse<T = unknown> {
  success: boolean;
  data: T;
  timestamp: string;
}

export interface TimestampedRecord {
  createdAt: string;
  updatedAt?: string;
}
