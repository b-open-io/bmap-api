import { MongoClient } from 'mongodb';

let connection: Promise<MongoClient> | undefined;

type State = { _id: string; height: number };

// Cache the in-flight connection too: concurrent first requests must share one pool.
async function getClient(): Promise<MongoClient> {
  if (!connection) {
    const url = process.env.BMAP_MONGO_URL;
    if (!url) throw new Error('BMAP_MONGO_URL is required');
    const client = new MongoClient(url, {
      minPoolSize: 0,
      maxPoolSize: 10,
      maxIdleTimeMS: 60_000,
      waitQueueTimeoutMS: 10_000,
      serverSelectionTimeoutMS: 10_000,
      timeoutMS: 15_000,
    });
    connection = client.connect().catch(async (error) => {
      connection = undefined;
      await client.close();
      throw error;
    });
  }
  return connection;
}

const getDbo = async () => (await getClient()).db('bsocial');
const getBAPDbo = async () => (await getClient()).db('bap');

const closeDb = async () => {
  const pending = connection;
  connection = undefined;
  if (pending) await (await pending).close();
};

async function getCollectionCounts(fromTimestamp: number): Promise<Record<string, number>[]> {
  const dbo = await getDbo();
  const collections = await dbo.listCollections().toArray();

  const countPromises = collections.map(async (c) => {
    let count = 0;

    if (fromTimestamp) {
      const query = { timestamp: { $gt: fromTimestamp } };
      count = await dbo.collection(c.name).countDocuments(query);
    } else {
      count = await dbo.collection(c.name).estimatedDocumentCount();
    }
    return [c.name, count];
  });

  const countsArray = await Promise.all(countPromises);
  return Object.fromEntries(countsArray) as Record<string, number>[];
}

async function getCurrentBlockHeight(): Promise<number> {
  const _dbo = await getDbo();
  const state = await getState();
  return state ? state.height : 0;
}

async function getState(): Promise<State | undefined> {
  const dbo = await getDbo();
  return await dbo.collection('_state').findOne<State>({});
}

export { closeDb, getBAPDbo, getCollectionCounts, getCurrentBlockHeight, getDbo, getState };

// db.c.createIndex({
//   "MAP.app": 1,
//   "MAP.type": 1,
// })

// db.c.createIndex({
//   "MAP.app": 1,
//   "MAP.type": 1,
//   "blk.t": -1,
// })

// db.c.createIndex({
//   "MAP.app": 1,
//   "MAP.type": 1,
//   "blk.i": -1,
// })
