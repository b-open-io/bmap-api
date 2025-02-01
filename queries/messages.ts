import type { BmapTx } from 'bmapjs';
import type { ChangeStream } from 'mongodb';
import type { BapIdentity } from '../bap.js';
import { getBAPIdByAddress } from '../bap.js';
import { getDbo } from '../db.js';
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

  const query = targetBapId
    ? {
        $or: [
          { 'MAP.bapID': bapId, 'MAP.targetBapID': targetBapId },
          { 'MAP.bapID': targetBapId, 'MAP.targetBapID': bapId },
        ],
      }
    : {
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
      if (aip.algorithm_signing_component) {
        signerAddresses.add(aip.algorithm_signing_component);
      }
      if (aip.address) {
        signerAddresses.add(aip.address);
      }
    }
  }

  // Get BAP identities for all signers
  const signers = await Promise.all(
    Array.from(signerAddresses).map((address) => getBAPIdByAddress(address))
  );

  return {
    bapID: bapId,
    page,
    limit,
    count,
    results: results.map((msg) => ({
      ...msg,
      MAP: msg.MAP.map((m) => ({
        ...m,
        bapID: m.bapID || '',
      })),
      B: msg.B.map((b) => ({
        encoding: b?.encoding || '',
        Data: {
          utf8: b.Data?.utf8 || '',
          data: b.Data?.data || '',
        },
      })),
    })),
    signers: signers.map((s) => ({
      idKey: s.idKey,
      rootAddress: s.rootAddress,
      currentAddress: s.currentAddress,
      addresses: s.addresses,
      block: s.block || 0,
      timestamp: s.timestamp || 0,
      valid: s.valid ?? true,
      identityTxId: s.identityTxId || '',
      identity: typeof s.identity === 'string' ? s.identity : JSON.stringify(s.identity) || '',
    })),
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
  return dbo.collection('message').watch([
    {
      $match: {
        $or: [
          {
            $and: [
              { 'fullDocument.MAP.bapID': bapId },
              {
                $or: [
                  { 'fullDocument.AIP.algorithm_signing_component': targetAddress },
                  { 'fullDocument.AIP.address': targetAddress },
                ],
              },
            ],
          },
          {
            $and: [
              { 'fullDocument.MAP.bapID': targetBapId },
              {
                $or: [
                  { 'fullDocument.AIP.algorithm_signing_component': bapAddress },
                  { 'fullDocument.AIP.address': bapAddress },
                ],
              },
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
  return dbo.collection('message').watch([
    {
      $match: {
        $or: [
          { 'fullDocument.MAP.bapID': bapId },
          { 'fullDocument.AIP.algorithm_signing_component': bapAddress },
          { 'fullDocument.AIP.address': bapAddress },
        ],
      },
    },
  ]);
}
