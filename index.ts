import { cors } from '@elysiajs/cors';
import { staticPlugin } from '@elysiajs/static';
import { swagger } from '@elysiajs/swagger';
import type { Static } from '@sinclair/typebox';
import chalk from 'chalk';
import dotenv from 'dotenv';
import { Elysia, NotFoundError, t } from 'elysia';
import type { ChangeStreamDocument } from 'mongodb';

import type { BmapTx } from 'bmapjs';

import './logger.js'; // Initialize logger first
import './p2p.js';
import { resolveSigners } from './bap.js';
import { handleTxRequest } from './handlers/transaction.js';
import {
  client,
  getBlockHeightFromCache,
} from './cache.js';
import { getBlocksRange, getTimeSeriesData } from './chart.js';
import { API_HOST, API_PORT } from './config/constants.js';
import { getDbo } from './db.js';
import { errorHandlerPlugin } from './middleware/errorHandler.js';
import { processTransaction } from './process.js';
import { explorerTemplate } from './src/components/explorer.js';
import { Timeframe } from './types.js';

import type { ChangeStream } from 'mongodb';
import { bitcoinSchemaCollections, htmxRoutes } from './htmx.js';
import { socialRoutes } from './social/routes.js';

dotenv.config();

// Define request types
const QueryParams = t.Object({
  collectionName: t.String(),
  base64Query: t.String(),
});

const ChartParams = t.Object({
  name: t.Optional(t.String()),
  timeframe: t.Optional(t.String()),
});

const IngestBody = t.Object({
  rawTx: t.String(),
});

type IngestRequest = Static<typeof IngestBody>;



// Create and configure the Elysia app using method chaining
const app = new Elysia()
  // Error handling
  .use(errorHandlerPlugin())
  // Plugins
  .use(cors())
  .use(staticPlugin({ assets: './public', prefix: '/' }))
  .use(
    swagger({
      documentation: {
        info: {
          title: 'BMAP API',
          version: '1.0.0',
          description: 'Bitcoin transaction processing and social features API',
        },
        tags: [
          { name: 'explorer', description: 'Visual query builder and data exploration tools' },
          { name: 'transactions', description: 'Transaction processing and retrieval' },
          { name: 'social', description: 'Social features like friends, likes, and channels' },
          { name: 'charts', description: 'Chart data generation endpoints' },
          { name: 'identities', description: 'BAP identity management' },
          { name: 'htmx', description: 'HTMX-powered dynamic UI updates' },
        ],
        security: [{ apiKey: [] }],
        components: {
          schemas: {
            Query: {
              type: 'object',
              properties: {
                v: { type: 'number' },
                q: {
                  type: 'object',
                  properties: {
                    find: { type: 'object' },
                    aggregate: { type: 'array', items: { type: 'object' } },
                    sort: { type: 'object' },
                    limit: { type: 'number' },
                    project: { type: 'object' },
                  },
                },
              },
            },
            BapIdentity: {
              type: 'object',
              properties: {
                idKey: { type: 'string', description: 'BAP Identity Key' },
                rootAddress: { type: 'string', description: 'Root Bitcoin address' },
                currentAddress: { type: 'string', description: 'Current active Bitcoin address' },
                addresses: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      address: { type: 'string', description: 'Bitcoin address' },
                      txId: {
                        type: 'string',
                        description: 'Transaction ID where address was claimed',
                      },
                      block: {
                        type: 'number',
                        description: 'Block height of claim',
                        nullable: true,
                      },
                    },
                  },
                },
                identity: { type: 'string', description: 'Identity data JSON string' },
                identityTxId: { type: 'string', description: 'Transaction ID of identity claim' },
                block: { type: 'number', description: 'Block height of identity registration' },
                timestamp: { type: 'number', description: 'Unix timestamp of registration' },
                valid: { type: 'boolean', description: 'Whether the identity is valid' },
              },
              required: ['idKey', 'rootAddress', 'currentAddress', 'addresses'],
            },
          },
        },
      },
      path: '/docs',
      exclude: ['/', '/app/public/*'],
      excludeStaticFile: true,
    })
  )
  // Derived context, e.g. SSE request timeout
  .derive(() => ({
    requestTimeout: 0,
  }))

  // Lifecycle hooks
  .onRequest(({ request }) => {
    // Only log 404s and errors, but we can log all requests if you prefer
    console.log(chalk.gray(`${request.method} ${request.url}`));
  })
  .onError(({ error, request }) => {
    console.log({ error });
    const accept = request.headers.get('accept') || '';
    const wantsJSON = accept.includes('application/json');

    if (error instanceof NotFoundError) {
      console.log(chalk.yellow(`404: ${request.method} ${request.url}`));
      if (wantsJSON) {
        return new Response(JSON.stringify({ error: `Not Found: ${request.url}` }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(`<div class="text-yellow-500">Not Found: ${request.url}</div>`, {
        status: 404,
        headers: { 'Content-Type': 'text/html' },
      });
    }

    if ('code' in error && error.code === 'VALIDATION') {
      console.log('Validation error details:', error);
      console.log('Request URL:', request.url);
      console.log('Request method:', request.method);
      const errorMessage = error instanceof Error ? error.message : 'Validation Error';
      if (wantsJSON) {
        return new Response(JSON.stringify({ error: errorMessage }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(`<div class="text-orange-500">Validation Error: ${errorMessage}</div>`, {
        status: 400,
        headers: { 'Content-Type': 'text/html' },
      });
    }

    if ('code' in error && error.code === 'PARSE') {
      const errorMessage = error instanceof Error ? error.message : 'Parse Error';
      if (wantsJSON) {
        return new Response(JSON.stringify({ error: errorMessage }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(`<div class="text-red-500">Parse Error: ${errorMessage}</div>`, {
        status: 400,
        headers: { 'Content-Type': 'text/html' },
      });
    }

    console.error(chalk.red(`Error: ${request.method} ${request.url}`), error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    const debug = process.env.DEBUG === 'true';
    const responsePayload = debug
      ? { error: errorMessage, stack: error instanceof Error ? error.stack : undefined }
      : { error: errorMessage };

    if (wantsJSON) {
      return new Response(JSON.stringify(responsePayload), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(`<div class="text-red-500">Server error: ${errorMessage}</div>`, {
      status: 500,
      headers: { 'Content-Type': 'text/html' },
    });
  })
  .group('/social', (app) => app.use(socialRoutes))
  .use(htmxRoutes)
  // Routes
  .get(
    '/s/:collectionName?/:base64Query',
    async ({ params, set }) => {
      const { collectionName, base64Query: b64 } = params;

      Object.assign(set.headers, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'X-Accel-Buffering': 'no',
        Connection: 'keep-alive',
      });

      try {
        const json = Buffer.from(b64, 'base64').toString();
        const db = await getDbo();

        console.log(chalk.blue('New change stream subscription on', collectionName));
        const query = JSON.parse(json);

        const pipeline = [{ $match: { operationType: 'insert' } }];
        const keys = Object.keys(query.q.find || {});
        for (const k of keys) {
          pipeline[0].$match[`fullDocument.${k}`] = query.q.find[k];
        }

        let changeStream: ChangeStream | undefined;
        const messageQueue: string[] = [];
        let isActive = true;

        async function* eventGenerator() {
          try {
            if (collectionName === '$all') {
              changeStream = db.watch(pipeline, { fullDocument: 'updateLookup' });
            } else {
              const target = db.collection(collectionName);
              changeStream = target.watch(pipeline, { fullDocument: 'updateLookup' });
            }

            yield `data: ${JSON.stringify({ type: 'open', data: [] })}\n\n`;

            changeStream.on('change', (next: ChangeStreamDocument<BmapTx>) => {
              if (next.operationType === 'insert' && isActive) {
                const eventType = next.fullDocument?.MAP?.[0]?.type || next.ns.coll;
                messageQueue.push(
                  `data: ${JSON.stringify({ type: eventType, data: [next.fullDocument] })}\n\n`
                );
              }
            });

            changeStream.on('error', (error) => {
              console.error(chalk.red('Change stream error:'), error);
              isActive = false;
            });

            changeStream.on('close', () => {
              console.log(chalk.blue('Change stream closed'));
              isActive = false;
            });

            while (isActive) {
              while (messageQueue.length > 0) {
                yield messageQueue.shift();
              }
              yield ':heartbeat\n\n';
              await new Promise((resolve) => setTimeout(resolve, 1000));
            }
          } finally {
            isActive = false;
            if (changeStream) {
              try {
                await changeStream.close();
              } catch (e) {
                console.error('Error during change stream closure:', e);
              }
            }
          }
        }

        return eventGenerator();
      } catch (error) {
        console.error(chalk.red('SSE setup error:'), error);
        throw new Error(
          `Failed to initialize event stream: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    },
    {
      params: QueryParams,
      detail: {
        tags: ['query'],
        description:
          'Subscribe to real-time updates for MongoDB queries using Server-Sent Events (SSE)',
        summary: 'Stream query results',
        parameters: [
          {
            name: 'collectionName',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            description: 'Collection to watch, use "$all" to watch all collections',
          },
          {
            name: 'base64Query',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            description: 'Base64-encoded MongoDB query (same format as /q endpoint)',
          },
        ],
        responses: {
          200: {
            description: 'Server-Sent Events stream of query results',
            content: {
              'text/event-stream': {
                schema: {
                  type: 'object',
                  properties: {
                    type: {
                      type: 'string',
                      description: 'Event type (collection name or "open")',
                      example: 'message',
                    },
                    data: {
                      type: 'array',
                      items: {
                        type: 'object',
                        description: 'BMAP transaction object',
                      },
                      description: 'Array of matching documents',
                    },
                  },
                },
              },
            },
          },
        },
      },
    }
  )

  .get(
    '/',
    () => {
      return new Response(Bun.file('./public/index.html'));
    },
    {
      detail: {
        tags: ['explorer'],
        description: 'Main dashboard page showing collection statistics and sync status',
        summary: 'Dashboard',
        responses: {
          200: {
            description: 'HTML dashboard page',
            content: {
              'text/html': {
                schema: {
                  type: 'string',
                },
              },
            },
          },
        },
      },
    }
  )

  .get(
    '/query/:collectionName',
    ({ params }) => {
      const collectionName = params.collectionName;
      const q = { q: { find: { 'MAP.type': collectionName } } };
      const code = JSON.stringify(q, null, 2);

      return new Response(explorerTemplate('BMAP', code), {
        headers: { 'Content-Type': 'text/html' },
      });
    },
    {
      detail: {
        tags: ['explorer'],
        description: 'Visual query builder for a specific collection',
        summary: 'Collection explorer',
        parameters: [
          {
            name: 'collectionName',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            description: 'Name of the collection to explore',
          },
        ],
        responses: {
          200: {
            description: 'HTML query builder page',
            content: {
              'text/html': {
                schema: {
                  type: 'string',
                },
              },
            },
          },
        },
      },
    }
  )

  .get(
    '/query/:collectionName/:base64Query',
    async ({ params }) => {
      const { base64Query: b64 } = params;
      const code = Buffer.from(b64, 'base64').toString();

      return new Response(explorerTemplate('BMAP', code), {
        headers: { 'Content-Type': 'text/html' },
      });
    },
    {
      detail: {
        tags: ['explorer'],
        description: 'Visual query builder with pre-filled query',
        summary: 'Query explorer',
        parameters: [
          {
            name: 'collectionName',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            description: 'Name of the collection to explore',
          },
          {
            name: 'base64Query',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            description: 'Base64-encoded MongoDB query',
          },
        ],
        responses: {
          200: {
            description: 'HTML query builder page',
            content: {
              'text/html': {
                schema: {
                  type: 'string',
                },
              },
            },
          },
        },
      },
    }
  )

  .get(
    '/q/:collectionName/:base64Query',
    async ({ params }) => {
      const { collectionName, base64Query: b64 } = params;
      console.log(chalk.magenta('BMAP API'), chalk.cyan('query', collectionName));

      const dbo = await getDbo();
      const code = Buffer.from(b64, 'base64').toString();
      const j = JSON.parse(code);

      if (j.q.aggregate) {
        try {
          const pipeline = j.q.aggregate;
          if (j.q.sort) {
            pipeline.push({ $sort: j.q.sort });
          }
          if (j.q.limit) {
            pipeline.push({ $limit: j.q.limit });
          }

          const c = await dbo
            .collection(collectionName)
            .aggregate(pipeline, {
              allowDiskUse: true,
              cursor: { batchSize: 1000 },
            })
            .toArray();

          const signers = await resolveSigners(c as BmapTx[]);
          return { [collectionName]: c, signers };
        } catch (e) {
          console.log(e);
          throw new Error(String(e));
        }
      }

      try {
        const c = await dbo
          .collection(collectionName)
          .find(j.q.find)
          .sort(j.q.sort || { _id: -1 })
          .limit(j.q.limit ? j.q.limit : 10)
          .project(j.q.project || { in: 0, out: 0 })
          .toArray();
        const signers = await resolveSigners(c as BmapTx[]);
        console.log({ signers });
        return { [collectionName]: c, signers };
      } catch (e) {
        console.log(e);
        throw new Error(String(e));
      }
    },
    {
      params: QueryParams,
      detail: {
        tags: ['query'],
        description: 'Execute MongoDB queries with text search support',
        summary: 'Query MongoDB collections',
        responses: {
          200: {
            description: 'Query results with resolved signers',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    collectionName: {
                      type: 'array',
                      items: { type: 'object' },
                    },
                    signers: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          idKey: { type: 'string' },
                          rootAddress: { type: 'string' },
                          currentAddress: { type: 'string' },
                          addresses: {
                            type: 'array',
                            items: {
                              type: 'object',
                              properties: {
                                address: { type: 'string' },
                                txId: { type: 'string' },
                                block: { type: 'number' },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    }
  )

  .post(
    '/ingest',
    async ({ body }: { body: IngestRequest }) => {
      const { rawTx } = body;
      console.log('Received ingest request with rawTx length:', rawTx.length);

      try {
        const tx = (await processTransaction(rawTx)) as BmapTx | null;
        if (!tx) throw new Error('No result returned');

        console.log('Transaction processed successfully:', tx.tx?.h);
        return tx;
      } catch (error) {
        console.error('Error processing transaction:', error);
        throw new Error(`Transaction processing failed: ${error}`);
      }
    },
    {
      body: IngestBody,
      detail: {
        tags: ['transactions'],
        description: 'Process and store a raw Bitcoin transaction',
        summary: 'Ingest transaction',
        responses: {
          200: {
            description: 'Transaction processed successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
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
                  },
                },
              },
            },
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
  )

  .get(
    '/chart-data/:name?',
    async ({ params }) => {
      console.log('Starting chart-data request');
      try {
        const timeframe = (params.timeframe as string) || Timeframe.Day;
        const collectionName = params.name;
        console.log('Chart data request for:', { collectionName, timeframe });

        const currentBlockHeight = await getBlockHeightFromCache();
        const [startBlock, endBlock] = getBlocksRange(currentBlockHeight, timeframe);
        console.log('Block range:', startBlock, '-', endBlock);

        let range = 1;
        switch (timeframe) {
          case Timeframe.Day:
            range = 1;
            break;
          case Timeframe.Week:
            range = 7;
            break;
          case Timeframe.Month:
            range = 30;
            break;
          case Timeframe.Year:
            range = 365;
            break;
        }

        if (!collectionName) {
          const dbo = await getDbo();
          const allCollections = await dbo.listCollections().toArray();
          const allDataPromises = allCollections.map((c) =>
            getTimeSeriesData(c.name, startBlock, endBlock, range)
          );
          const allTimeSeriesData = await Promise.all(allDataPromises);

          const globalData: Record<number, number> = {};
          for (const collectionData of allTimeSeriesData) {
            for (const { _id, count } of collectionData) {
              globalData[_id] = (globalData[_id] || 0) + count;
            }
          }

          const aggregatedData = Object.keys(globalData).map((blockHeight) => ({
            _id: Number(blockHeight),
            count: globalData[blockHeight],
          }));

          return {
            labels: aggregatedData.map((d) => d._id),
            values: aggregatedData.map((d) => d.count),
            range: [startBlock, endBlock],
          };
        }

        const timeSeriesData = await getTimeSeriesData(collectionName, startBlock, endBlock, range);
        return {
          labels: timeSeriesData.map((d) => d._id),
          values: timeSeriesData.map((d) => d.count),
          range: [startBlock, endBlock],
        };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to generate chart data: ${message}`);
      }
    },
    {
      params: ChartParams,
      detail: {
        tags: ['explorer'],
        description: 'Get time series data for charts',
        summary: 'Chart data',
        parameters: [
          {
            name: 'name',
            in: 'path',
            required: false,
            schema: {
              type: 'string',
              enum: bitcoinSchemaCollections,
            },
            description: 'Collection name to get chart data for',
          },
          {
            name: 'timeframe',
            in: 'query',
            required: false,
            schema: {
              type: 'string',
              enum: Object.values(Timeframe),
            },
            description: 'Time range for the chart data',
          },
        ],
        responses: {
          200: {
            description: 'Chart data points',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      t: { type: 'number', description: 'Timestamp' },
                      y: { type: 'number', description: 'Value' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    }
  );

// Function to start listening after any async initialization
async function start() {
  console.log(chalk.magenta('BMAP API'), chalk.cyan('initializing machine...'));
  await client.connect();

  app.listen({ port: API_PORT, hostname: API_HOST }, () => {
    console.log(chalk.magenta('BMAP API'), chalk.green(`listening on ${API_HOST}:${API_PORT}!`));
  });
}

start();
