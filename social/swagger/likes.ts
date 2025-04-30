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
    address: string;
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
              address: t.String(),
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

export const likesEndpointDetail: OpenAPIV3.OperationObject = {
  tags: ['social'],
  description: 'Get likes for transactions or messages',
  summary: 'Get likes',
  requestBody: {
    description: 'Transaction IDs or Message IDs to get likes for',
    required: true,
    content: {
      'application/json': {
        schema: {
          type: 'object',
          properties: {
            txids: {
              type: 'array',
              items: { type: 'string' },
              description: 'List of transaction IDs',
            },
            messageIds: {
              type: 'array',
              items: { type: 'string' },
              description: 'List of message IDs',
            },
          },
        },
      },
    },
  },
  responses: {
    '200': {
      description: 'Likes with signer information',
      content: {
        'application/json': {
          schema: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                txid: { type: 'string' },
                likes: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      tx: { type: 'object', properties: { h: { type: 'string' } } },
                      blk: {
                        type: 'object',
                        properties: {
                          i: { type: 'number' },
                          t: { type: 'number' },
                        },
                      },
                      MAP: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            type: { type: 'string' },
                            tx: { type: 'string' },
                            messageID: { type: 'string' },
                            emoji: { type: 'string' },
                          },
                        },
                      },
                    },
                  },
                },
                total: { type: 'number' },
                signers: {
                  type: 'array',
                  items: {
                    $ref: '#/components/schemas/BapIdentity',
                  },
                },
              },
            },
          },
        },
      },
    },
  },
};
