import { t } from 'elysia';
import type { OpenAPIV3 } from 'openapi-types';

// Query parameters
export const MessageQuery = t.Object({
  page: t.Optional(t.String()),
  limit: t.Optional(t.String()),
});

// Response schemas
export const ChannelMessageSchema = t.Object({
  channel: t.String(),
  page: t.Number(),
  limit: t.Number(),
  count: t.Number(),
  results: t.Array(t.Object({
    tx: t.Object({ h: t.String() }),
    blk: t.Object({ i: t.Number(), t: t.Number() }),
    MAP: t.Array(t.Object({
      app: t.String(),
      type: t.String(),
      paymail: t.Optional(t.String()),
      context: t.Optional(t.String()),
      channel: t.Optional(t.String()),
      bapID: t.Optional(t.String()),
    })),
    B: t.Array(t.Object({
      encoding: t.String(),
      content: t.Optional(t.String()),
      'content-type': t.Optional(t.String()),
    })),
    AIP: t.Optional(t.Array(t.Object({
      algorithm: t.String(),
      address: t.String(),
    }))),
  })),
  signers: t.Array(t.Any()), // BapIdentity array
});

export const MessageListenParams = t.Object({
  bapId: t.String(),
  targetBapId: t.Optional(t.String()),
});

export const DMResponseSchema = t.Object({
  messages: t.Array(t.Object({
    bapId: t.String(),
    decrypted: t.Boolean(),
    encrypted: t.Optional(t.String()),
    tx: t.Object({ h: t.String() }),
    timestamp: t.Number(),
    blk: t.Object({ i: t.Number(), t: t.Number() }),
    _id: t.String(),
  })),
  lastMessage: t.Optional(t.Object({
    bapId: t.String(),
    decrypted: t.Boolean(),
    encrypted: t.Optional(t.String()),
    tx: t.Object({ h: t.String() }),
    timestamp: t.Number(),
    blk: t.Object({ i: t.Number(), t: t.Number() }),
    _id: t.String(),
  })),
});

// OpenAPI Documentation
export const channelMessagesEndpointDetail: OpenAPIV3.OperationObject = {
  summary: 'Get messages from a channel',
  description: 'Fetches paginated messages from a specific channel',
  tags: ['Messages'],
  parameters: [
    {
      name: 'channelId',
      in: 'path',
      required: true,
      schema: { type: 'string' },
      description: 'The channel ID to fetch messages from',
    },
    {
      name: 'page',
      in: 'query',
      schema: { type: 'string' },
      description: 'Page number for pagination',
    },
    {
      name: 'limit',
      in: 'query',
      schema: { type: 'string' },
      description: 'Number of messages per page',
    },
  ],
  responses: {
    '200': {
      description: 'Successful response with channel messages',
      content: {
        'application/json': {
          schema: {
            $ref: '#/components/schemas/ChannelMessage',
          },
        },
      },
    },
  },
};

export const messageListenEndpointDetail: OpenAPIV3.OperationObject = {
  summary: 'Listen to messages via WebSocket',
  description: 'Establishes a WebSocket connection to listen for real-time messages',
  tags: ['Messages'],
  parameters: [
    {
      name: 'bapId',
      in: 'path',
      required: true,
      schema: { type: 'string' },
      description: 'Your BAP ID',
    },
    {
      name: 'targetBapId',
      in: 'path',
      required: false,
      schema: { type: 'string' },
      description: 'Target BAP ID for direct messages (optional)',
    },
  ],
  responses: {
    '101': {
      description: 'Switching Protocols - WebSocket connection established',
    },
  },
};

export const directMessagesEndpointDetail: OpenAPIV3.OperationObject = {
  summary: 'Get direct messages',
  description: 'Fetches paginated direct messages for a BAP ID',
  tags: ['Messages'],
  parameters: [
    {
      name: 'bapId',
      in: 'path',
      required: true,
      schema: { type: 'string' },
      description: 'The BAP ID to fetch messages for',
    },
    {
      name: 'page',
      in: 'query',
      schema: { type: 'string' },
      description: 'Page number for pagination',
    },
    {
      name: 'limit',
      in: 'query',
      schema: { type: 'string' },
      description: 'Number of messages per page',
    },
  ],
  responses: {
    '200': {
      description: 'Successful response with direct messages',
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
  summary: 'Get direct messages with specific user',
  description: 'Fetches paginated direct messages between two BAP IDs',
  tags: ['Messages'],
  parameters: [
    {
      name: 'bapId',
      in: 'path',
      required: true,
      schema: { type: 'string' },
      description: 'Your BAP ID',
    },
    {
      name: 'targetBapId',
      in: 'path',
      required: true,
      schema: { type: 'string' },
      description: 'Target BAP ID',
    },
    {
      name: 'page',
      in: 'query',
      schema: { type: 'string' },
      description: 'Page number for pagination',
    },
    {
      name: 'limit',
      in: 'query',
      schema: { type: 'string' },
      description: 'Number of messages per page',
    },
  ],
  responses: {
    '200': {
      description: 'Successful response with direct messages',
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