import { Elysia, t } from 'elysia';
import { EXTERNAL_APIS } from '../config/constants.js';
import { handleTxRequest } from '../handlers/transaction.js';
import { BmapTxSchema, SignerSchema } from '../schemas/core.js';
import { IngestBody, type IngestRequest } from '../schemas/requests.js';

// External API response type
const ExternalIngestResponse = t.Object({
  status: t.String(),
  message: t.Optional(t.String()),
  data: t.Optional(t.Any()),
});

export const transactionRoutes = new Elysia()
  .post(
    '/ingest',
    async ({ body, set }: { body: IngestRequest; set: { status: number } }) => {
      const { rawTx } = body;
      console.log('Received ingest request, forwarding to bsocial overlay API...');

      try {
        // Forward to external bsocial overlay API
        const response = await fetch(`${EXTERNAL_APIS.BAP}ingest`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ rawTx }),
        });

        const result = await response.json();

        // Pass through the external API's response
        if (!response.ok) {
          set.status = response.status;
          return result;
        }

        console.log('Transaction successfully processed by bsocial overlay:', result);
        return result;
      } catch (error) {
        console.error('Error forwarding to bsocial overlay API:', error);
        set.status = 500;
        return {
          status: 'ERROR',
          message: `Failed to forward to bsocial overlay: ${error}`,
        };
      }
    },
    {
      body: IngestBody,
      response: {
        200: ExternalIngestResponse,
        400: ExternalIngestResponse,
        422: ExternalIngestResponse,
        500: ExternalIngestResponse,
      },
      detail: {
        tags: ['transactions'],
        description: 'Forward raw Bitcoin transaction to bsocial overlay API for processing',
        summary: 'Ingest transaction via bsocial overlay',
        responses: {
          200: {
            description: 'Transaction processed successfully by bsocial overlay',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', description: 'Status of the operation' },
                    message: { type: 'string', description: 'Optional message' },
                    data: { type: 'object', description: 'Optional response data' },
                  },
                },
              },
            },
          },
          400: {
            description: 'Bad request from bsocial overlay',
          },
          422: {
            description: 'Invalid transaction data',
          },
          500: {
            description: 'Internal server error',
          },
        },
      },
    }
  )

  .get(
    '/tx/:tx/:format?',
    async ({ params }) => {
      const { tx: txid, format } = params;
      return handleTxRequest(txid, format);
    },
    {
      params: t.Object({
        tx: t.String({
          description: 'Transaction ID to fetch',
          examples: ['1234abcd'],
        }),
        format: t.Optional(
          t.Union(
            [
              t.Literal('bob'),
              t.Literal('bmap'),
              t.Literal('file'),
              t.Literal('raw'),
              t.Literal('signer'),
              t.Literal('json'),
            ],
            {
              description: 'Response format',
              examples: ['bob', 'bmap', 'file', 'signer', 'raw', 'json'],
            }
          )
        ),
      }),
      response: {
        200: t.Union([
          // BMAP format
          t.Object({
            tx: t.Object({
              h: t.String(),
            }),
            in: t.Optional(t.Array(t.Object({}))),
            out: t.Optional(t.Array(t.Object({}))),
            MAP: t.Optional(t.Array(t.Object({}))),
            AIP: t.Optional(t.Array(t.Object({}))),
            B: t.Optional(t.Array(t.Object({}))),
            blk: t.Optional(
              t.Object({
                i: t.Number(),
                t: t.Number(),
              })
            ),
            timestamp: t.Optional(t.Number()),
            lock: t.Optional(t.Number()),
          }),
          // BOB format
          t.Object({
            _id: t.String(),
            tx: t.Object({
              h: t.String(),
              r: t.String(),
            }),
            in: t.Array(t.Object({})),
            out: t.Array(t.Object({})),
            parts: t.Array(t.Object({})),
          }),
          // Raw response (hex string)
          t.String(),
          // BAP Identity response
          t.Object({
            idKey: t.String(),
            rootAddress: t.String(),
            currentAddress: t.String(),
            addresses: t.Array(
              t.Object({
                address: t.String(),
                txId: t.String(),
                block: t.Optional(t.Number()),
              })
            ),
            identity: t.Union([t.String(), t.Object({})]),
            identityTxId: t.String(),
            block: t.Number(),
            timestamp: t.Number(),
            valid: t.Boolean(),
            paymail: t.Optional(t.String()),
            displayName: t.Optional(t.String()),
            icon: t.Optional(t.String()),
          }),
          // Response instance (for file downloads)
          t.Any(),
        ]),
      },
      detail: {
        tags: ['transactions'],
        description: 'Get transaction details in various formats',
        summary: 'Get transaction',
        responses: {
          200: {
            description: 'Transaction details in requested format',
            content: {
              'application/json': {
                schema: {
                  oneOf: [
                    {
                      type: 'object',
                      description: 'BMAP format (when format=bmap or not specified)',
                      properties: {
                        tx: {
                          type: 'object',
                          properties: {
                            h: { type: 'string', description: 'Transaction hash' },
                          },
                        },
                        blk: {
                          type: 'object',
                          properties: {
                            i: { type: 'number', description: 'Block height' },
                            t: { type: 'number', description: 'Block timestamp' },
                          },
                        },
                        MAP: { type: 'array', items: { type: 'object' } },
                        AIP: { type: 'array', items: { type: 'object' } },
                        B: { type: 'array', items: { type: 'object' } },
                      },
                    },
                    {
                      type: 'object',
                      description: 'BOB format (when format=bob)',
                      properties: {
                        _id: { type: 'string' },
                        tx: {
                          type: 'object',
                          properties: {
                            h: { type: 'string' },
                            r: { type: 'string' },
                          },
                        },
                        in: { type: 'array', items: { type: 'object' } },
                        out: { type: 'array', items: { type: 'object' } },
                        parts: { type: 'array', items: { type: 'object' } },
                      },
                    },
                    {
                      type: 'string',
                      description: 'Raw transaction hex (when format=raw)',
                    },
                  ],
                },
              },
              'text/plain': {
                schema: {
                  type: 'string',
                  format: 'binary',
                  description: 'File content (when format=file)',
                },
              },
            },
          },
        },
      },
    }
  );
