import type { ChangeStream } from 'mongodb';
import { getDbo } from '../db.js';

interface MessageQueryParams {
  bapId: string;
  bapAddress: string;
  targetBapId?: string;
  targetAddress?: string;
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
