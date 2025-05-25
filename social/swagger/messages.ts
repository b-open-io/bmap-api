import type { OpenAPIV3 } from 'openapi-types';

export const channelMessagesEndpointDetail: OpenAPIV3.OperationObject = {
  tags: ['social'],
  description: 'Get messages from a specific channel',
  summary: 'Get channel messages',
  parameters: [
    {
      name: 'channelId',
      in: 'path',
      required: true,
      schema: { type: 'string' },
      description: 'Channel identifier',
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
      description: 'Channel messages with signer information',
      content: {
        'application/json': {
          schema: {
            $ref: '#/components/schemas/ChannelMessage',
          },
        },
      },
    },
    '400': {
      description: 'Bad Request - Invalid parameters',
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
    '500': {
      description: 'Internal Server Error',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              channel: { type: 'string' },
              page: { type: 'number' },
              limit: { type: 'number' },
              count: { type: 'number' },
              results: { type: 'array', items: {} },
              signers: { type: 'array', items: {} },
            },
          },
        },
      },
    },
  },
};

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
      description: 'Invalid BAP ID',
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
