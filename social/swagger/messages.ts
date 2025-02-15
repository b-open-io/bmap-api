import type { BmapTx } from 'bmapjs';
import { t } from 'elysia';
import type { OpenAPIV3 } from 'openapi-types';
import type { BapIdentity } from '../../bap.js';

export interface Message {
  tx: {
    h: string;
  };
  blk: {
    i: number;
    t: number;
  };
  MAP: {
    app: string;
    type: string;
    paymail?: string;
    context?: string;
    channel?: string;
    bapID?: string;
  }[];
  B: {
    encoding: string;
    Data: {
      utf8: string;
      data?: string;
    };
  }[];
  AIP?: {
    algorithm: string;
    address: string;
    algorithm_signing_component: string;
  }[];
}

export interface ChannelMessage {
  channel: string;
  page: number;
  limit: number;
  count: number;
  results: Message[];
  signers: BapIdentity[];
}

export const MessageQuery = t.Object({
  page: t.Optional(t.String()),
  limit: t.Optional(t.String()),
});

export const ChannelMessageSchema = t.Object({
  channel: t.String(),
  page: t.Number(),
  limit: t.Number(),
  count: t.Number(),
  results: t.Array(
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
          app: t.String(),
          type: t.String(),
          paymail: t.Optional(t.String()),
          context: t.Optional(t.String()),
          channel: t.Optional(t.String()),
          bapID: t.Optional(t.String()),
        })
      ),
      B: t.Array(
        t.Object({
          encoding: t.String(),
          Data: t.Object({
            utf8: t.String(),
            data: t.Optional(t.String()),
          }),
        })
      ),
      AIP: t.Optional(
        t.Array(
          t.Object({
            algorithm: t.String(),
            address: t.Optional(t.String()),
            algorithm_signing_component: t.Optional(t.String()),
          })
        )
      ),
    })
  ),
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
});

export const channelMessagesEndpointDetail: OpenAPIV3.OperationObject = {
  tags: ['social'],
  description: 'Get messages from a specific channel',
  summary: 'Get channel messages',
  parameters: [
    {
      name: 'channelId',
      in: 'path',
      required: true,
      schema: { type: 'string' as const },
      description: 'Channel identifier',
    },
    {
      name: 'page',
      in: 'query',
      schema: { type: 'string' as const },
      description: 'Page number for pagination',
    },
    {
      name: 'limit',
      in: 'query',
      schema: { type: 'string' as const },
      description: 'Number of messages per page',
    },
  ],
  responses: {
    '200': {
      description: 'Channel messages with signer information',
      content: {
        'application/json': {
          schema: {
            type: 'object' as const,
            properties: {
              channel: { type: 'string' as const },
              page: { type: 'number' as const },
              limit: { type: 'number' as const },
              count: { type: 'number' as const },
              results: {
                type: 'array' as const,
                items: {
                  type: 'object' as const,
                  properties: {
                    tx: {
                      type: 'object' as const,
                      properties: {
                        h: { type: 'string' as const },
                      },
                    },
                    blk: {
                      type: 'object' as const,
                      properties: {
                        i: { type: 'number' as const },
                        t: { type: 'number' as const },
                      },
                    },
                    MAP: {
                      type: 'array' as const,
                      items: {
                        type: 'object' as const,
                        properties: {
                          app: { type: 'string' as const },
                          type: { type: 'string' as const },
                          channel: { type: 'string' as const },
                          paymail: { type: 'string' as const },
                        },
                      },
                    },
                    B: {
                      type: 'array' as const,
                      items: {
                        type: 'object' as const,
                        properties: {
                          encoding: { type: 'string' as const },
                          Data: {
                            type: 'object' as const,
                            properties: {
                              utf8: { type: 'string' as const },
                              data: { type: 'string' as const },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
              signers: {
                type: 'array' as const,
                items: {
                  $ref: '#/components/schemas/BapIdentity',
                },
              },
            },
          },
        },
      },
    },
    '400': {
      description: 'Bad Request - Invalid parameters',
      content: {
        'application/json': {
          schema: {
            type: 'object' as const,
            properties: {
              error: { type: 'string' as const },
            },
          },
        },
      },
    },
    '500': {
      description: 'Internal Server Error',
      content: {
        'application/json': {
          schema: {
            type: 'object' as const,
            properties: {
              channel: { type: 'string' as const },
              page: { type: 'number' as const },
              limit: { type: 'number' as const },
              count: { type: 'number' as const },
              results: { type: 'array' as const, items: {} },
              signers: { type: 'array' as const, items: {} },
            },
          },
        },
      },
    },
  },
};
export const MessageListenParams = t.Object({
  params: t.Object({
    bapId: t.String(),
    targetBapId: t.Optional(t.String()),
  }),
});

export const messageListenEndpointDetail: OpenAPIV3.OperationObject = {
  tags: ['social'],
  description: 'Listen to real-time messages for a BAP ID',
  parameters: [
    {
      name: 'bapId',
      in: 'path',
      required: true,
      schema: { type: 'string' },
      description: 'BAP Identity Key',
    },
    {
      name: 'targetBapId',
      in: 'path',
      required: false,
      schema: { type: 'string' },
      description: 'Optional target BAP Identity Key for direct messages',
    },
  ],
  responses: {
    '101': {
      description: 'WebSocket connection established',
    },
    '400': {
      description: 'Invalid BAP identity',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              error: { type: 'string' },
            },
          },
        },
      },
    },
  },
};

export interface DMResponse {
  bapID: string;
  page: number;
  limit: number;
  count: number;
  results: BmapTx[];
  signers: BapIdentity[];
}

export const DMResponseSchema = t.Object({
  bapID: t.String(),
  page: t.Number(),
  limit: t.Number(),
  count: t.Number(),
  results: t.Array(
    t.Object({
      timestamp: t.Number(),
      tx: t.Object({
        h: t.String(),
      }),
      blk: t.Object({
        i: t.Number(),
        t: t.Number(),
      }),
      MAP: t.Array(
        t.Object({
          app: t.String(),
          type: t.String(),
          bapID: t.String(),
          encrypted: t.Optional(t.String()),
          context: t.Literal('bapID'),
        })
      ),
      B: t.Array(
        t.Object({
          Data: t.Object({
            utf8: t.String(),
            data: t.Optional(t.String()),
          }),
          encoding: t.String(),
        })
      ),
      AIP: t.Optional(
        t.Array(
          t.Object({
            algorithm: t.String(),
            address: t.Optional(t.String()),
            algorithm_signing_component: t.Optional(t.String()),
          })
        )
      ),
    })
  ),
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
});

export const directMessagesEndpointDetail: OpenAPIV3.OperationObject = {
  tags: ['social'],
  description: 'Get encrypted direct messages for a BAP ID',
  parameters: [
    {
      name: 'bapId',
      in: 'path',
      required: true,
      schema: { type: 'string' },
      description: 'Recipient BAP Identity Key',
    },
  ],
  responses: {
    '200': {
      description: 'Direct messages for BAP ID',
      content: {
        'application/json': {
          schema: {
            $ref: '#/components/schemas/DMResponse',
          },
        },
      },
    },
  },
};

export const directMessagesWithTargetEndpointDetail: OpenAPIV3.OperationObject = {
  tags: ['social'],
  description: 'Get encrypted direct messages between two BAP IDs',
  parameters: [
    {
      name: 'bapId',
      in: 'path',
      required: true,
      schema: { type: 'string' },
      description: 'Recipient BAP Identity Key',
    },
    {
      name: 'targetBapId',
      in: 'path',
      required: true,
      schema: { type: 'string' },
      description: 'Target BAP Identity Key',
    },
  ],
  responses: {
    '200': {
      description: 'Direct messages between BAP IDs',
      content: {
        'application/json': {
          schema: {
            $ref: '#/components/schemas/DMResponse',
          },
        },
      },
    },
  },
};
