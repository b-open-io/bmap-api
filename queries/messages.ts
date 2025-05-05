import type { BmapTx } from 'bmapjs';
import type { ChangeStream } from 'mongodb';
import type { BapIdentity } from '../bap.js';
import { getBAPIdByAddress, getSigners } from '../bap.js';
import { PROTOCOL_START_BLOCK } from '../constants.js';
import { getDbo } from '../db.js';
import { fetchBapIdentityData } from '../social/queries/identity.js';
import type { DMResponse } from '../social/swagger/messages.js';

interface MessageQueryParams {
  bapId: string;
  bapAddress: string;
  targetBapId?: string;
  targetAddress?: string;
}

interface DirectMessagesParams {
  bapId: string;
  targetBapId?: string | null;
  page: number;
  limit: number;
}

/**
 * Fetches direct messages between two BAP IDs with pagination
 */
export async function getDirectMessages({
  bapId,
  targetBapId = null,
  page = 1,
  limit = 100,
}: DirectMessagesParams): Promise<DMResponse> {
  const dbo = await getDbo();
  const skip = (page - 1) * limit;

  // Get current address for BAP ID
  const identity = await fetchBapIdentityData(bapId);
  if (!identity?.currentAddress) {
    throw new Error('Invalid BAP identity data');
  }

  // Add this block to fetch target identity
  let targetIdentity: BapIdentity | null = null;
  if (targetBapId) {
    targetIdentity = await fetchBapIdentityData(targetBapId);
    if (!targetIdentity?.currentAddress) {
      throw new Error('Invalid target BAP identity');
    }
  }

  // Block height condition: either 0 (mempool) or greater than PROTOCOL_START_BLOCK
  const blockHeightCondition = {
    $or: [{ 'blk.i': 0 }, { 'blk.i': { $gt: PROTOCOL_START_BLOCK } }],
  };

  const query = targetBapId
    ? {
        $and: [
          { 'MAP.type': 'message', ...blockHeightCondition },

          {
            'MAP.bapID': targetBapId,
            'AIP.address': identity.currentAddress,
          },
          {
            'MAP.bapID': bapId,
            'AIP.address': targetIdentity.currentAddress,
          },
        ],
      }
    : {
        'MAP.type': 'message',
        ...blockHeightCondition,
        'MAP.bapID': bapId,
      };

  const [results, count] = await Promise.all([
    dbo.collection('message').find(query).sort({ 'blk.t': -1 }).skip(skip).limit(limit).toArray(),
    dbo.collection('message').countDocuments(query),
  ]);

  // Get unique signer addresses
  const signerAddresses = new Set<string>();
  for (const msg of results) {
    if (!msg.AIP) continue;
    for (const aip of msg.AIP) {
      if (aip.address) {
        signerAddresses.add(aip.address);
      }
    }
  }

  // Get BAP identities for all signers
  const signers = await getSigners([...signerAddresses])

  return {
    bapID: bapId,
    page,
    limit,
    count,
    results: results.map((msg) => ({
      ...msg,
      tx: { h: msg.tx?.h || '' },
      blk: msg.blk || { i: 0, t: 0 },
      timestamp: msg.timestamp || msg.blk?.t || Math.floor(Date.now() / 1000),
      MAP: msg.MAP.map((m) => ({
        ...m,
        bapID: m.bapID || '',
      })),
      B: msg.B.map((b) => ({
        encoding: b?.encoding || '',
        content: b?.content || '',
        "content-type": (b && b['content-type']) || ''
      })),
    })),
    signers,
  };
}

/**
 * Creates a MongoDB change stream pipeline for watching direct messages between two BAP IDs
 */
export async function watchDirectMessages({
  bapId,
  bapAddress,
  targetBapId,
  targetAddress,
}: MessageQueryParams): Promise<ChangeStream> {
  const dbo = await getDbo();

  // Block height condition for change stream: either 0 (mempool) or greater than PROTOCOL_START_BLOCK
  const blockHeightCondition = {
    $or: [{ 'fullDocument.blk.i': 0 }, { 'fullDocument.blk.i': { $gt: PROTOCOL_START_BLOCK } }],
  };

  return dbo.collection('message').watch([
    {
      $match: {
        $or: [
          {
            $and: [
              {
                'fullDocument.MAP.bapID': bapId,
                ...blockHeightCondition,
              },
              { 'fullDocument.AIP.address': targetAddress },
            ],
          },
          {
            $and: [
              {
                'fullDocument.MAP.bapID': targetBapId,
                ...blockHeightCondition,
              },
              { 'fullDocument.AIP.address': bapAddress },
            ],
          },
        ],
      },
    },
  ]);
}

/**
 * Creates a MongoDB change stream pipeline for watching all messages for a BAP ID
 */
export async function watchAllMessages({
  bapId,
  bapAddress,
}: MessageQueryParams): Promise<ChangeStream> {
  const dbo = await getDbo();

  // Block height condition for change stream: either 0 (mempool) or greater than PROTOCOL_START_BLOCK
  const blockHeightCondition = {
    $or: [{ 'fullDocument.blk.i': 0 }, { 'fullDocument.blk.i': { $gt: PROTOCOL_START_BLOCK } }],
  };

  return dbo.collection('message').watch([
    {
      $match: {
        $and: [
          {
            'fullDocument.MAP.bapID': bapId,
            ...blockHeightCondition,
          },
          { 'fullDocument.AIP.address': bapAddress },
        ],
      },
    },
  ]);
}
