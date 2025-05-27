import { t, type Static } from 'elysia';

// Define request types
export const QueryParams = t.Object({
  collectionName: t.String(),
  base64Query: t.String(),
});

export const ChartParams = t.Object({
  name: t.Optional(t.String()),
  timeframe: t.Optional(t.String()),
});

export const IngestBody = t.Object({
  rawTx: t.String({
    description: 'Raw transaction hex string',
    minLength: 1,
  }),
});

export type IngestRequest = Static<typeof IngestBody>;