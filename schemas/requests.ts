import { type Static, t } from 'elysia';

// Transaction-specific request schemas (not duplicated elsewhere)
export const IngestBody = t.Object({
  rawTx: t.String({
    description: 'Raw transaction hex string',
    minLength: 2,
    maxLength: 2 * 1024 * 1024,
    pattern: '^(?:[a-fA-F0-9]{2})+$',
  }),
});

export type IngestRequest = Static<typeof IngestBody>;
