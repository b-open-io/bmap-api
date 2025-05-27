export const swaggerConfig = {
  documentation: {
    info: {
      title: 'BMAP API',
      version: '1.0.0',
      description: 'Bitcoin transaction processing and social features API',
    },
    tags: [
      { name: 'explorer', description: 'Visual query builder and data exploration tools' },
      { name: 'transactions', description: 'Transaction processing and retrieval' },
      { name: 'social', description: 'Social features like friends, likes, and channels' },
      { name: 'charts', description: 'Chart data generation endpoints' },
      { name: 'identities', description: 'BAP identity management' },
      { name: 'htmx', description: 'HTMX-powered dynamic UI updates' },
      { name: 'posts', description: 'Post management endpoints' },
      { name: 'query', description: 'MongoDB query endpoints' },
    ],
    security: [{ apiKey: [] }],
    // Temporarily commented out due to type compatibility issues
    // components: {
    //   schemas: {
    //     Query: {
    //       type: 'object',
    //       properties: {
    //         v: { type: 'number' },
    //         q: {
    //           type: 'object',
    //           properties: {
    //             find: { type: 'object' },
    //             aggregate: { type: 'array', items: { type: 'object' } },
    //             sort: { type: 'object' },
    //             limit: { type: 'number' },
    //             project: { type: 'object' },
    //           },
    //         },
    //       },
    //     },
    //     BapIdentity: {
    //       type: 'object',
    //       properties: {
    //         idKey: { type: 'string', description: 'BAP Identity Key' },
    //         rootAddress: { type: 'string', description: 'Root Bitcoin address' },
    //         currentAddress: { type: 'string', description: 'Current active Bitcoin address' },
    //         addresses: {
    //           type: 'array',
    //           items: {
    //             type: 'object',
    //             properties: {
    //               address: { type: 'string', description: 'Bitcoin address' },
    //               txId: {
    //                 type: 'string',
    //                 description: 'Transaction ID where address was claimed',
    //               },
    //               block: {
    //                 type: 'number',
    //                 description: 'Block height of claim',
    //                 nullable: true,
    //               },
    //             },
    //           },
    //         },
    //         identity: { type: 'string', description: 'Identity data JSON string' },
    //         identityTxId: { type: 'string', description: 'Transaction ID of identity claim' },
    //         block: { type: 'number', description: 'Block height of identity registration' },
    //         timestamp: { type: 'number', description: 'Unix timestamp of registration' },
    //         valid: { type: 'boolean', description: 'Whether the identity is valid' },
    //       },
    //       required: ['idKey', 'rootAddress', 'currentAddress', 'addresses'],
    //     },
    //   },
    // },
  },
  path: '/docs',
  exclude: ['/', '/app/public/*'],
  excludeStaticFile: true,
};