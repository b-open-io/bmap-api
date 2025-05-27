import { Elysia } from 'elysia';

export interface ApiError extends Error {
  statusCode?: number;
  code?: string;
}

export class NotFoundError extends Error implements ApiError {
  statusCode = 404;
  code = 'NOT_FOUND';

  constructor(message = 'Resource not found') {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends Error implements ApiError {
  statusCode = 400;
  code = 'VALIDATION_ERROR';

  constructor(message = 'Validation error') {
    super(message);
    this.name = 'ValidationError';
  }
}

export class UnauthorizedError extends Error implements ApiError {
  statusCode = 401;
  code = 'UNAUTHORIZED';

  constructor(message = 'Unauthorized') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export class ServerError extends Error implements ApiError {
  statusCode = 500;
  code = 'SERVER_ERROR';

  constructor(message = 'Internal server error') {
    super(message);
    this.name = 'ServerError';
  }
}

export function errorHandlerPlugin() {
  return new Elysia()
    .error({
      NOT_FOUND: NotFoundError,
      VALIDATION_ERROR: ValidationError,
      UNAUTHORIZED: UnauthorizedError,
      SERVER_ERROR: ServerError,
    })
    .onError(({ error, set, code }) => {
      console.error(`Error [${code}]:`, error);

      // Handle known API errors
      if ('statusCode' in error && typeof error.statusCode === 'number') {
        set.status = error.statusCode;
        return {
          error: {
            code: error.code || code,
            message: error.message,
          },
        };
      }

      // Handle validation errors from Elysia
      if (code === 'VALIDATION') {
        set.status = 400;
        return {
          error: {
            code: 'VALIDATION_ERROR',
            message: error.message || 'Validation failed',
          },
        };
      }

      // Handle not found errors
      if (code === 'NOT_FOUND') {
        set.status = 404;
        return {
          error: {
            code: 'NOT_FOUND',
            message: error.message || 'Not found',
          },
        };
      }

      // Default error response
      set.status = 500;
      return {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred',
        },
      };
    });
}
