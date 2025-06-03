import { Elysia } from 'elysia';
import type { Context } from 'elysia';

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

interface ValidationErrorDetails {
  message?: string;
  validator?: {
    Errors: (value: unknown) => { First(): { message: string } };
  };
  all?: Array<{
    path?: string;
    message?: string;
    summary?: string;
  }>;
}

interface ErrorHandlerContext {
  code: string;
  error: ValidationErrorDetails;
  set: {
    status: number;
  };
}

/**
 * Create a cleaner validation error response
 */
function formatValidationError(error: ValidationErrorDetails): { error: string; details?: Record<string, string[]> } {
  // Check if it's a validation error with the validator property
  if (error.validator && error.all) {
    const errors = error.all;

    // If there's only one error, show a simple message
    if (errors.length === 1) {
      const singleError = errors[0];
      return {
        error:
          `${singleError.path?.replace(/^\//, '')}: ${singleError.message}` || 'Validation failed',
      };
    }

    // For multiple errors, group by field
    const fieldErrors: Record<string, string[]> = {};

    for (const err of errors) {
      const field = err.path?.replace(/^\//, '') || 'root';
      if (!fieldErrors[field]) {
        fieldErrors[field] = [];
      }
      fieldErrors[field].push(err.message || '');
    }

    // Create a clean summary
    const summary = Object.entries(fieldErrors)
      .map(([field, messages]) => `${field}: ${messages.join(', ')}`)
      .join('; ');

    return {
      error: `Validation failed: ${summary}`,
      details: fieldErrors,
    };
  }

  // Fallback for other validation errors
  return {
    error: error.message || 'Validation failed',
  };
}

/**
 * Global error handler for Elysia app
 */
export function createErrorHandler() {
  return ({ code, error, set }: ErrorHandlerContext) => {
    console.error(`Error [${code}]:`, error);

    switch (code) {
      case 'VALIDATION':
        set.status = 400;
        return formatValidationError(error);

      case 'NOT_FOUND':
        set.status = 404;
        return { error: 'Resource not found' };

      case 'INTERNAL_SERVER_ERROR':
        set.status = 500;
        return { error: 'Internal server error' };

      default:
        set.status = 500;
        return { error: error.message || 'Unknown error occurred' };
    }
  };
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
