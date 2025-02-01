import type { BmapTx } from 'bmapjs';
import { getBAPIdByAddress } from '../../bap.js';
import { getDbo } from '../../db.js';
import type { Friend, FriendshipResponse, RelationshipState } from '../swagger/friend.js';
import { fetchBapIdentityData } from './identity.js';

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

  // Get incoming friend requests (where this BAP ID is the target)
  const incomingFriends = (await dbo
    .collection('friend')
    .find({ 'MAP.type': 'friend', 'MAP.bapID': bapId })
    .toArray()) as unknown as BmapTx[];

  console.log('Incoming friends count:', incomingFriends.length);
  console.log(
    'Incoming friends:',
    JSON.stringify(
      incomingFriends.map((f) => ({
        txid: f.tx?.h,
        bapID: f.MAP?.[0]?.bapID,
        address: f.AIP?.[0]?.algorithm_signing_component || f.AIP?.[0]?.address,
      })),
      null,
      2
    )
  );

  // Get outgoing friend requests (where this BAP ID's addresses are the source)
  const outgoingFriends = (await dbo
    .collection('friend')
    .find({
      'MAP.type': 'friend',
      $or: [
        { 'AIP.algorithm_signing_component': { $in: [...ownedAddresses] } },
        { 'AIP.address': { $in: [...ownedAddresses] } },
      ],
    })
    .toArray()) as unknown as BmapTx[];

  // Try to get unfriend documents if the collection exists
  let incomingUnfriends: BmapTx[] = [];
  let outgoingUnfriends: BmapTx[] = [];

  try {
    const collections = await dbo.listCollections().toArray();
    const hasUnfriendCollection = collections.some((c) => c.name === 'unfriend');

    if (hasUnfriendCollection) {
      incomingUnfriends = (await dbo
        .collection('unfriend')
        .find({ 'MAP.type': 'unfriend', 'MAP.bapID': bapId })
        .toArray()) as unknown as BmapTx[];

      outgoingUnfriends = (await dbo
        .collection('unfriend')
        .find({
          'MAP.type': 'unfriend',
          $or: [
            { 'AIP.algorithm_signing_component': { $in: [...ownedAddresses] } },
            { 'AIP.address': { $in: [...ownedAddresses] } },
          ],
        })
        .toArray()) as unknown as BmapTx[];
    }
  } catch (error) {
    console.warn('Failed to query unfriend collection:', error);
  }

  console.log('Outgoing friends count:', outgoingFriends.length);
  console.log(
    'Outgoing friends:',
    JSON.stringify(
      outgoingFriends.map((f) => ({
        txid: f.tx?.h,
        bapID: f.MAP?.[0]?.bapID,
        address: f.AIP?.[0]?.algorithm_signing_component || f.AIP?.[0]?.address,
      })),
      null,
      2
    )
  );

  const allDocs = [
    ...incomingFriends,
    ...incomingUnfriends,
    ...outgoingFriends,
    ...outgoingUnfriends,
  ];
  allDocs.sort((a, b) => (a.blk?.i ?? 0) - (b.blk?.i ?? 0));

  console.log('Total documents:', allDocs.length);
  return { allDocs, ownedAddresses };
}

export async function processRelationships(
  bapId: string,
  docs: BmapTx[],
  ownedAddresses: Set<string>
): Promise<FriendshipResponse> {
  console.log('\n=== processRelationships ===');
  console.log('Processing relationships for BAP ID:', bapId);
  console.log('Number of documents:', docs.length);
  console.log('Owned addresses:', [...ownedAddresses]);

  const relationships = new Map<string, RelationshipState>();

  async function getRequestorBapId(doc: BmapTx): Promise<string | null> {
    // Check all possible address fields
    const address = doc?.AIP?.[0]?.algorithm_signing_component || doc?.AIP?.[0]?.address;
    if (!address) {
      console.log('No address found in document:', doc.tx?.h);
      return null;
    }

    if (ownedAddresses.has(address)) {
      console.log('Address matches owned address:', address);
      return bapId;
    }

    console.log('Looking up BAP ID for address:', address);
    const otherIdentity = await getBAPIdByAddress(address);
    if (!otherIdentity) {
      console.log('No identity found for address:', address);
      return null;
    }
    console.log('Found BAP ID for address:', otherIdentity.idKey);
    return otherIdentity.idKey;
  }

  const requestors = await Promise.all(docs.map((doc) => getRequestorBapId(doc)));
  console.log('Resolved requestors:', requestors);

  for (let i = 0; i < docs.length; i++) {
    const doc = docs[i];
    const reqBap = requestors[i];
    const tgtBap = doc?.MAP?.[0]?.bapID;
    const publicKey = doc?.MAP?.[0]?.publicKey;

    console.log('\nProcessing document:', doc.tx?.h);
    console.log('Requestor BAP:', reqBap);
    console.log('Target BAP:', tgtBap);

    if (!reqBap || !tgtBap || !Array.isArray(doc.MAP)) {
      console.log('Skipping document - missing required fields');
      continue;
    }

    const otherBapId = reqBap === bapId ? tgtBap : reqBap;
    console.log('Other BAP ID:', otherBapId);

    if (otherBapId && typeof otherBapId === 'string' && !relationships.has(otherBapId)) {
      console.log('Creating new relationship for:', otherBapId);
      relationships.set(otherBapId, { fromMe: false, fromThem: false, unfriended: false });
    }

    const rel = relationships.get(typeof otherBapId === 'string' ? otherBapId : '');
    if (!rel) {
      console.log('No relationship found for:', otherBapId);
      continue;
    }

    const isFriend = doc?.MAP?.[0]?.type === 'friend';
    const isUnfriend = doc?.MAP?.[0]?.type === 'unfriend';
    const isFromMe = reqBap === bapId;

    console.log('Document type:', isFriend ? 'friend' : isUnfriend ? 'unfriend' : 'unknown');
    console.log('Is from me:', isFromMe);

    if (isUnfriend) {
      console.log('Processing unfriend');
      rel.unfriended = true;
      rel.fromMe = false;
      rel.fromThem = false;
    } else if (isFriend) {
      console.log('Processing friend');
      if (rel.unfriended) {
        rel.unfriended = false;
      }
      if (isFromMe) {
        rel.fromMe = true;
        rel.mePublicKey = publicKey;
      } else {
        rel.fromThem = true;
        rel.themPublicKey = publicKey;
      }
    }

    console.log(
      'Updated relationship:',
      JSON.stringify({
        otherBapId,
        fromMe: rel.fromMe,
        fromThem: rel.fromThem,
        unfriended: rel.unfriended,
      })
    );
  }

  const friends: Friend[] = [];
  const incoming: string[] = [];
  const outgoing: string[] = [];

  console.log('\nFinal relationships:');
  for (const [other, rel] of relationships.entries()) {
    console.log('Processing final relationship:', other, JSON.stringify(rel));

    if (rel.unfriended) {
      console.log('Skipping unfriended relationship:', other);
      continue;
    }
    if (rel.fromMe && rel.fromThem) {
      console.log('Adding mutual friend:', other);
      friends.push({
        bapID: other,
        mePublicKey: rel.mePublicKey || '',
        themPublicKey: rel.themPublicKey || '',
      });
    } else if (rel.fromMe && !rel.fromThem) {
      console.log('Adding outgoing friend:', other);
      outgoing.push(other);
    } else if (!rel.fromMe && rel.fromThem) {
      console.log('Adding incoming friend:', other);
      incoming.push(other);
    }
  }

  console.log('\nFinal results:');
  console.log('Friends:', friends);
  console.log('Incoming:', incoming);
  console.log('Outgoing:', outgoing);

  return { friends, incoming, outgoing };
}
