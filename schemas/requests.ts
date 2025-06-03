import { type Static, t } from 'elysia';

// Transaction-specific request schemas (not duplicated elsewhere)
export const IngestBody = t.Object({
  rawTx: t.String({
    description: 'Raw transaction hex string',
    minLength: 1,
  }),
});

export type IngestRequest = Static<typeof IngestBody>;
