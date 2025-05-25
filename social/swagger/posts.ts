import type { OpenAPIV3 } from 'openapi-types';

// OpenAPI endpoint documentation for posts
export const postsEndpointDetail: OpenAPIV3.OperationObject = {
  tags: ['social'],
  description: 'Get posts from the blockchain',
  summary: 'List posts',
  parameters: [
    {
      name: 'page',
      in: 'query',
      schema: { type: 'number', default: 1 },
      description: 'Page number for pagination',
    },
    {
      name: 'limit',
      in: 'query',
      schema: { type: 'number', default: 20 },
      description: 'Number of items per page',
    },
  ],
  responses: {
    '200': {
      description: 'List of posts',
      content: {
        'application/json': {
          schema: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/post',
            },
          },
        },
      },
    },
  },
};