use('bmap');

db.getCollectionNames();

// Get a recent post with content
db.getCollection('post').findOne(
  { 'B.content': { $ne: '', $exists: true } },
  { B: 1, AIP: 1, MAP: 1, blk: 1 },
  { sort: { 'blk.i': -1 } }
);

// Check if both fields exist
db.getCollection('post').findOne(
  {},
  { 'AIP.address': 1, 'AIP.algorithm_signing_component': 1, 'AIP.algorithm': 1 },
  { sort: { 'blk.i': -1 } }
);
