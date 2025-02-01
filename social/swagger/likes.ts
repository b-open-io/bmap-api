import { t } from 'elysia';
import type { OpenAPIV3 } from 'openapi-types';
import type { BapIdentity } from '../../bap.js';

export interface Reactions {
  channel: string;
  page: number;
  limit: number;
  count: number;
  results: Reaction[];
}

export interface Reaction {
  tx: {
    h: string;
  };
  blk: {
    i: number;
    t: number;
  };
  MAP: {
    type: string;
    tx?: string;
    messageID?: string;
    emoji?: string;
  }[];
  AIP?: {
    algorithm_signing_component: string;
  }[];
}

export interface LikeRequest {
  txids?: string[];
  messageIds?: string[];
}

export interface LikeInfo {
  txid: string;
  likes: Reaction[];
  total: number;
  signers: BapIdentity[]; // Full signer objects for API response
}

export const LikeRequestSchema = t.Object({
  txids: t.Optional(t.Array(t.String())),
  messageIds: t.Optional(t.Array(t.String())),
});

export const LikeResponseSchema = t.Array(
  t.Object({
    txid: t.String(),
    likes: t.Array(
      t.Object({
        tx: t.Object({
          h: t.String(),
        }),
        blk: t.Object({
          i: t.Number(),
          t: t.Number(),
        }),
        MAP: t.Array(
          t.Object({
            type: t.String(),
            tx: t.Optional(t.String()),
            messageID: t.Optional(t.String()),
            emoji: t.Optional(t.String()),
          })
        ),
        AIP: t.Optional(
          t.Array(
            t.Object({
              algorithm_signing_component: t.String(),
            })
          )
        ),
      })
    ),
    total: t.Number(),
    signers: t.Array(
      t.Object({
        idKey: t.String(),
        rootAddress: t.String(),
        currentAddress: t.String(),
        addresses: t.Array(
          t.Object({
            address: t.String(),
            txId: t.String(),
            block: t.Optional(t.Number()),
          })
        ),
        identity: t.String(),
        identityTxId: t.String(),
        block: t.Number(),
        timestamp: t.Number(),
        valid: t.Boolean(),
      })
    ),
  })
);
