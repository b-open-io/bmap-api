import type { BmapTx } from 'bmapjs';
import { Elysia, t } from 'elysia';
import { resolveSigners } from '../bap.js';
import { getDbo } from '../db.js';
import { SignerSchema } from '../schemas/core.js';
import { collectQuery, parseQuery } from '../utils/query.js';
import { sseRoutes } from './sse.js';

export const queryRoutes = new Elysia().use(sseRoutes).get(
  '/q/:collectionName/:base64Query',
  async ({ params }) => {
    const query = parseQuery(params.collectionName, params.base64Query);
    const dbo = await getDbo();
    const collection = dbo.collection(params.collectionName);
    const cursor = query.aggregate
      ? collection.aggregate(query.aggregate, {
          allowDiskUse: true,
          maxTimeMS: 10_000,
          batchSize: 10,
        })
      : collection
          .find(query.find, { maxTimeMS: 10_000, batchSize: 10 })
          .sort(query.sort)
          .skip(query.skip)
          .limit(query.limit)
          .project(query.project);
    const docs = await collectQuery(cursor);
    return { [params.collectionName]: docs, signers: await resolveSigners(docs as BmapTx[]) };
  },
  {
    params: t.Object({ collectionName: t.String(), base64Query: t.String({ maxLength: 32768 }) }),
    response: t.Object({ signers: t.Array(SignerSchema) }, { additionalProperties: true }),
    detail: {
      tags: ['query'],
      summary: 'Query MongoDB collections',
      description:
        'Read-only queries, at most 100 records and 4 MiB per response. Expensive operations time out after 10 seconds.',
    },
  }
);
