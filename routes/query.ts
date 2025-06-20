import type { BmapTx } from 'bmapjs';
import chalk from 'chalk';
import { Elysia, t } from 'elysia';
import type { ChangeStreamDocument } from 'mongodb';
import type { ChangeStream } from 'mongodb';
import { resolveSigners } from '../bap.js';
import { getDbo } from '../db.js';

// Import core schemas
import { SignerSchema } from '../schemas/core.js';

// Define request types
const QueryParams = t.Object({
  collectionName: t.String({ description: 'MongoDB collection name' }),
  base64Query: t.String({ description: 'Base64-encoded MongoDB query' }),
});

const QueryResponse = t.Object(
  {
    signers: t.Array(SignerSchema),
  },
  {
    additionalProperties: true, // Allow dynamic collection keys
  }
);

export const queryRoutes = new Elysia()
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
      response: QueryResponse,
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
  );
