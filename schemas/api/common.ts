import { t } from 'elysia';

// Common API response schemas

export const ErrorResponseSchema = t.Object({
  error: t.String(),
  message: t.Optional(t.String()),
  code: t.Optional(t.Number())
});

export const PaginationSchema = t.Object({
  limit: t.Optional(t.Number({ default: 100, maximum: 1000 })),
  offset: t.Optional(t.Number({ default: 0 })),
  sort: t.Optional(t.String())
});

export const BapIdParamSchema = t.Object({
  bapId: t.String({ minLength: 1 })
});

export const TxIdParamSchema = t.Object({
  txid: t.String({ minLength: 64, maxLength: 64 })
});