import type { Document, Sort } from 'mongodb';
import { ValidationError } from '../middleware/errorHandler.js';

const stages = new Set([
  '$match',
  '$sort',
  '$skip',
  '$limit',
  '$project',
  '$unset',
  '$count',
  '$group',
  '$unwind',
  '$addFields',
  '$set',
  '$replaceRoot',
  '$replaceWith',
  '$unionWith',
  '$lookup',
  '$facet',
  '$search',
]);
const forbidden = new Set([
  '$out',
  '$merge',
  '$where',
  '$function',
  '$accumulator',
  '__proto__',
  'constructor',
  'prototype',
]);
const collectionName = /^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/;

function object(value: unknown): value is Document {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function validate(value: unknown, depth = 0): void {
  if (depth > 20) throw new ValidationError('Query nesting exceeds 20 levels');
  if (Array.isArray(value)) {
    for (const item of value) validate(item, depth + 1);
  } else if (object(value)) {
    for (const [key, item] of Object.entries(value)) {
      if (forbidden.has(key)) throw new ValidationError(`Query operator ${key} is not allowed`);
      if (
        (key === 'from' || key === 'coll') &&
        (typeof item !== 'string' || !collectionName.test(item))
      )
        throw new ValidationError('Invalid joined collection');
      validate(item, depth + 1);
    }
  }
}

export function parseQuery(collection: string, encoded: string) {
  if (!collectionName.test(collection)) throw new ValidationError('Invalid collection name');
  if (encoded.length > 32768) throw new ValidationError('Query exceeds 32 KiB');
  let data: unknown;
  try {
    data = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'));
  } catch {
    throw new ValidationError('Invalid base64 JSON query');
  }
  if (!object(data) || !object(data.q)) throw new ValidationError('Expected a query object q');
  const q = data.q;
  validate(q);
  const limit = q.limit ?? 100;
  const skip = q.skip ?? 0;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100)
    throw new ValidationError('limit must be between 1 and 100');
  if (!Number.isSafeInteger(skip) || skip < 0 || skip > 100_000)
    throw new ValidationError('skip must be between 0 and 100000');
  if (
    q.sort !== undefined &&
    (!object(q.sort) || Object.values(q.sort).some((x) => x !== 1 && x !== -1))
  )
    throw new ValidationError('sort must contain 1 or -1 directions');
  if (q.find !== undefined && !object(q.find)) throw new ValidationError('find must be an object');
  if (q.project !== undefined && !object(q.project))
    throw new ValidationError('project must be an object');
  let aggregate: Document[] | undefined;
  if (q.aggregate !== undefined) {
    if (
      !Array.isArray(q.aggregate) ||
      q.aggregate.length > 30 ||
      q.aggregate.some(
        (stage) =>
          !object(stage) || Object.keys(stage).length !== 1 || !stages.has(Object.keys(stage)[0])
      )
    )
      throw new ValidationError('Expected at most 30 read-only aggregation stages');
    aggregate = [...q.aggregate];
    if (q.sort) aggregate.push({ $sort: q.sort });
    if (skip) aggregate.push({ $skip: skip });
    aggregate.push({ $limit: limit });
    if (q.project) aggregate.push({ $project: q.project });
  }
  return {
    aggregate,
    find: q.find ?? {},
    sort: (q.sort ?? { _id: -1 }) as Sort,
    skip,
    limit,
    project: q.project ?? { in: 0, out: 0 },
  };
}

// Do not materialize an unbounded cursor, even when a single document is very large.
export async function collectQuery(
  cursor: AsyncIterable<Document> & { close(): Promise<void> }
): Promise<Document[]> {
  const docs: Document[] = [];
  let bytes = 0;
  try {
    for await (const doc of cursor) {
      bytes += Buffer.byteLength(JSON.stringify(doc));
      if (bytes > 4 * 1024 * 1024 || docs.length >= 100)
        throw new ValidationError(
          'Query result exceeds 100 records or 4 MiB; narrow the query or projection'
        );
      docs.push(doc);
    }
    return docs;
  } finally {
    await cursor.close();
  }
}
