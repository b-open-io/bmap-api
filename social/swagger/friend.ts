import type { OpenAPIV3 } from 'openapi-types';

export const friendEndpointDetail: OpenAPIV3.OperationObject = {
  tags: ['social'],
  description: 'Get friend relationships for a BAP ID',
  summary: 'Get friends',
  parameters: [
    {
      name: 'bapId',
      in: 'path',
      required: true,
      schema: { type: 'string' },
      description: 'BAP Identity Key',
    },
  ],
  responses: {
    '200': {
      description: 'Friend relationships categorized by status',
      content: {
        'application/json': {
          schema: {
            $ref: '#/components/schemas/FriendResponse',
          },
        },
      },
    },
    '400': {
      description: 'Bad Request - Missing BAP ID',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              friends: { type: 'array', items: {} },
              incoming: { type: 'array', items: {} },
              outgoing: { type: 'array', items: {} },
            },
          },
        },
      },
    },
    '404': {
      description: 'BAP ID not found',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              friends: { type: 'array', items: {} },
              incoming: { type: 'array', items: {} },
              outgoing: { type: 'array', items: {} },
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
              friends: { type: 'array', items: {} },
              incoming: { type: 'array', items: {} },
              outgoing: { type: 'array', items: {} },
            },
          },
        },
      },
    },
  },
};
