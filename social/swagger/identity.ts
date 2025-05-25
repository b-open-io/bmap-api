import type { OpenAPIV3 } from 'openapi-types';

export const identityEndpointDetail: OpenAPIV3.OperationObject = {
  tags: ['social'],
  description: 'Get all cached BAP identities',
  summary: 'List identities',
  responses: {
    '200': {
      description: 'List of BAP identities',
      content: {
        'application/json': {
          schema: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/identity',
            },
          },
        },
      },
    },
    '503': {
      description: 'Service Unavailable - Redis connection issue',
      content: {
        'application/json': {
          schema: {
            type: 'array',
            items: {},
          },
        },
      },
    },
    '500': {
      description: 'Internal Server Error',
      content: {
        'application/json': {
          schema: {
            type: 'array',
            items: {},
          },
        },
      },
    },
  },
};
