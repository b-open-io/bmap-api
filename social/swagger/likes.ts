import type { OpenAPIV3 } from 'openapi-types';

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
              $ref: '#/components/schemas/likeInfo',
            },
          },
        },
      },
    },
  },
};
