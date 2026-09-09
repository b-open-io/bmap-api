import { Elysia, t } from 'elysia';
import { getDbo } from '../db.js';
import { parseQuery } from '../utils/query.js';
import { streamChanges } from '../utils/streams.js';

export const sseRoutes = new Elysia().get(
  '/s/:collectionName/:base64Query',
  async ({ params, request }) => {
    const collection = params.collectionName === '$all' ? 'all' : params.collectionName;
    const query = parseQuery(collection, params.base64Query);
    if (query.aggregate) return new Response('Streaming requires q.find', { status: 400 });
    const db = await getDbo();
    const match: Record<string, unknown> = { operationType: 'insert' };
    for (const [key, value] of Object.entries(query.find)) match[`fullDocument.${key}`] = value;
    const pipeline = [{ $match: match }];
    return streamChanges(
      () =>
        params.collectionName === '$all'
          ? db.watch(pipeline, { maxAwaitTimeMS: 1000, batchSize: 1, timeoutMS: 0 })
          : db
              .collection(params.collectionName)
              .watch(pipeline, { maxAwaitTimeMS: 1000, batchSize: 1, timeoutMS: 0 }),
      request.signal
    );
  },
  {
    params: t.Object({ collectionName: t.String(), base64Query: t.String({ maxLength: 32768 }) }),
    detail: {
      tags: ['query'],
      summary: 'Stream query results',
      description: 'Bounded, pull-based change stream. Disconnecting closes the database cursor.',
    },
  }
);
