import type { OpenAPIV3 } from 'openapi-types';

export const channelsEndpointDetail: OpenAPIV3.OperationObject = {
  tags: ['social'],
  description: 'Get list of all message channels',
  summary: 'List channels',
  responses: {
    '200': {
      description: 'List of channels with their latest messages',
      content: {
        'application/json': {
          schema: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/channelInfo',
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
              code: { type: 'string' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
  },
};