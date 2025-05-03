import type { BmapTx } from 'bmapjs';
import { getBAPIdByAddress } from '../../bap.js';
import { PROTOCOL_START_BLOCK } from '../../constants.js';
import { getDbo } from '../../db.js';
import type {
  Friend,
  FriendRequest,
  FriendshipResponse,
  RelationshipState,
} from '../swagger/friend.js';
import { fetchBapIdentityData } from './identity.js';

// Cache for BAP identities to reduce redundant lookups
const bapCache = new Map<string, string>();

export async function fetchAllFriendsAndUnfriends(
  bapId: string
): Promise<{ allDocs: BmapTx[]; ownedAddresses: Set<string> }> {
  console.log('\n=== fetchAllFriendsAndUnfriends ===');
  console.log('BAP ID:', bapId);

  const dbo = await getDbo();

  const idData = await fetchBapIdentityData(bapId);
  if (!idData || !idData.addresses) {
    throw new Error(`No identity found for ${bapId}`);
  }

  const ownedAddresses = new Set<string>(idData.addresses.map((a) => a.address));
  console.log('Owned addresses:', [...ownedAddresses]);

  // Block height condition: either 0 (mempool) or greater than PROTOCOL_START_BLOCK
  const blockHeightCondition = {
    $or: [{ 'blk.i': 0 }, { 'blk.i': { $gt: PROTOCOL_START_BLOCK } }],
  };

  // Use Promise.all to parallelize the queries
  const [incomingFriends, outgoingFriends, incomingUnfriends, outgoingUnfriends] =
    await Promise.all([
      // Get incoming friend requests
      dbo
        .collection('friend')
        .find({
          'MAP.type': 'friend',
          'MAP.bapID': bapId,
          ...blockHeightCondition,
        })
        .toArray() as Promise<BmapTx[]>,

      // Get outgoing friend requests
      dbo
        .collection('friend')
        .find({
          'MAP.type': 'friend',
          'AIP.address': { $in: [...ownedAddresses] },
          ...blockHeightCondition,
        })
        .toArray() as Promise<BmapTx[]>,

      // Get incoming unfriends (if collection exists)
      dbo
        .listCollections({ name: 'unfriend' })
        .hasNext()
        .then((hasUnfriend) =>
          hasUnfriend
            ? dbo
                .collection('unfriend')
                .find({
                  'MAP.type': 'unfriend',
                  'MAP.bapID': bapId,
                  ...blockHeightCondition,
                })
                .toArray()
            : []
        ) as Promise<BmapTx[]>,

      // Get outgoing unfriends (if collection exists)
      dbo
        .listCollections({ name: 'unfriend' })
        .hasNext()
        .then((hasUnfriend) =>
          hasUnfriend
            ? dbo
                .collection('unfriend')
                .find({
                  'MAP.type': 'unfriend',
                  'AIP.address': { $in: [...ownedAddresses] },
                  ...blockHeightCondition,
                })
                .toArray()
            : []
        ) as Promise<BmapTx[]>,
    ]);

  const allDocs = [
    ...incomingFriends,
    ...outgoingFriends,
    ...incomingUnfriends,
    ...outgoingUnfriends,
  ];
  allDocs.sort((a, b) => (a.blk?.i ?? 0) - (b.blk?.i ?? 0));

  return { allDocs, ownedAddresses };
}

export async function processRelationships(
  bapId: string,
  docs: BmapTx[],
  ownedAddresses: Set<string>
): Promise<FriendshipResponse> {
  console.log('\n=== processRelationships ===');
  const relationships = new Map<string, RelationshipState>();

  // Process documents in chunks to avoid memory spikes
  const CHUNK_SIZE = 50;
  for (let i = 0; i < docs.length; i += CHUNK_SIZE) {
    const chunk = docs.slice(i, i + CHUNK_SIZE);

    // Process each document in the chunk
    for (const doc of chunk) {
      const address = doc?.AIP?.[0]?.address;
      if (!address) continue;

      let reqBap: string | null;

      // Check cache first
      if (bapCache.has(address)) {
        reqBap = bapCache.get(address);
      } else {
        if (ownedAddresses.has(address)) {
          reqBap = bapId;
        } else {
          const otherIdentity = await getBAPIdByAddress(address);
          reqBap = otherIdentity?.idKey || null;
        }
        // Cache the result
        bapCache.set(address, reqBap);
      }

      const tgtBap = doc?.MAP?.[0]?.bapID;
      const publicKey = doc?.MAP?.[0]?.publicKey;
      const txid = doc?.tx?.h;
      const height = doc?.blk?.i || 0;

      if (!reqBap || !tgtBap || !txid) continue;

      const otherBapId = reqBap === bapId ? tgtBap : reqBap;

      if (!relationships.has(otherBapId)) {
        relationships.set(otherBapId, {
          fromMe: false,
          fromThem: false,
          unfriended: false,
          txids: [txid],
          txid,
          height,
        });
      }

      const rel = relationships.get(otherBapId);
      if (!rel) continue;

      const isFriend = doc?.MAP?.[0]?.type === 'friend';
      const isUnfriend = doc?.MAP?.[0]?.type === 'unfriend';
      const isFromMe = reqBap === bapId;

      if (isUnfriend) {
        rel.unfriended = true;
        rel.fromMe = false;
        rel.fromThem = false;
      } else if (isFriend) {
        if (rel.unfriended) {
          rel.unfriended = false;
        }
        if (isFromMe) {
          rel.fromMe = true;
          rel.mePublicKey = publicKey;
          rel.txid = txid
          rel.txids.push(txid);
          rel.height = height;
        } else {
          rel.fromThem = true;
          rel.themPublicKey = publicKey;
          rel.txid = txid;
          rel.txids.push(txid);
          rel.height = height;
        }
      }
    }

    // Small delay between chunks to allow GC
    if (i + CHUNK_SIZE < docs.length) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }

  const friends: Friend[] = [];
  const incoming: FriendRequest[] = [];
  const outgoing: FriendRequest[] = [];

  // Process relationships
  for (const [other, rel] of relationships.entries()) {
    if (rel.unfriended) continue;

    if (rel.fromMe && rel.fromThem) {
      friends.push({
        bapID: other,
        mePublicKey: rel.mePublicKey || '',
        themPublicKey: rel.themPublicKey || '',
      });
    } else if (rel.fromMe && !rel.fromThem) {
      outgoing.push({
        bapID: other,
        txid: rel.txid || '',
        height: rel.height || 0,
      });
    } else if (!rel.fromMe && rel.fromThem) {
      incoming.push({
        bapID: other,
        txid: rel.txid || '',
        height: rel.height || 0,
      });
    }
  }

  // Clear the cache if it gets too large
  if (bapCache.size > 1000) {
    bapCache.clear();
  }

  return { friends, incoming, outgoing };
}
