import { cors } from '@elysiajs/cors';
import { swagger } from '@elysiajs/swagger';
import chalk from 'chalk';
import dotenv from 'dotenv';
import { Elysia, NotFoundError } from 'elysia';
import type { ChangeStreamDocument } from 'mongodb';

import type { BmapTx } from 'bmapjs';

import './logger.js'; // Initialize logger first
import './p2p.js';
import { resolveSigners } from './bap.js';
import { client, getBlockHeightFromCache } from './cache.js';
import { getBlocksRange, getTimeSeriesData } from './chart.js';
import { API_HOST, API_PORT } from './config/constants.js';
import { getDbo } from './db.js';
import { handleTxRequest } from './handlers/transaction.js';
import { errorHandlerPlugin } from './middleware/errorHandler.js';
import { processTransaction } from './process.js';
import { Timeframe } from './types.js';

import type { ChangeStream } from 'mongodb';
import { analyticsRoutes, healthRoutes } from './analytics/routes.js';
import { chartRoutes } from './routes/chart.js';
import { queryRoutes } from './routes/query.js';
import { transactionRoutes } from './routes/transaction.js';
import { socialRoutes } from './social/routes.js';

dotenv.config();

// Create and configure the Elysia app using method chaining
const app = new Elysia()
  // Error handling
  .use(errorHandlerPlugin())
  // Plugins
  .use(cors())
  .use(
    swagger({
      documentation: {
        info: {
          title: 'BMAP API',
          version: '1.0.0',
          description: 'Bitcoin transaction processing and social features API',
        },
        tags: [
          { name: 'transactions', description: 'Transaction processing and retrieval' },
          { name: 'social', description: 'Social features like friends, likes, and channels' },
          { name: 'charts', description: 'Chart data generation endpoints' },
          { name: 'identities', description: 'BAP identity management' },
        ],
        security: [{ apiKey: [] }],
        components: {
          schemas: {
            Query: {
              type: 'object',
              properties: {
                v: { type: 'number' },
                q: {
                  type: 'object',
                  properties: {
                    find: { type: 'object' },
                    aggregate: { type: 'array', items: { type: 'object' } },
                    sort: { type: 'object' },
                    limit: { type: 'number' },
                    project: { type: 'object' },
                  },
                },
              },
            },
            BapIdentity: {
              type: 'object',
              properties: {
                idKey: { type: 'string', description: 'BAP Identity Key' },
                rootAddress: { type: 'string', description: 'Root Bitcoin address' },
                currentAddress: { type: 'string', description: 'Current active Bitcoin address' },
                addresses: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      address: { type: 'string', description: 'Bitcoin address' },
                      txId: {
                        type: 'string',
                        description: 'Transaction ID where address was claimed',
                      },
                      block: {
                        type: 'number',
                        description: 'Block height of claim',
                        nullable: true,
                      },
                    },
                  },
                },
                identity: { type: 'string', description: 'Identity data JSON string' },
                identityTxId: { type: 'string', description: 'Transaction ID of identity claim' },
                block: { type: 'number', description: 'Block height of identity registration' },
                timestamp: { type: 'number', description: 'Unix timestamp of registration' },
                valid: { type: 'boolean', description: 'Whether the identity is valid' },
              },
              required: ['idKey', 'rootAddress', 'currentAddress', 'addresses'],
            },
          },
        },
      },
      path: '/docs',
    })
  )
  // Derived context, e.g. SSE request timeout
  .derive(() => ({
    requestTimeout: 0,
  }))

  // Lifecycle hooks
  .onRequest(({ request }) => {
    // Only log 404s and errors, but we can log all requests if you prefer
    console.log(chalk.gray(`${request.method} ${request.url}`));
  })
  .onError(({ error, request }) => {
    console.log({ error });
    const accept = request.headers.get('accept') || '';
    const wantsJSON = accept.includes('application/json');

    if (error instanceof NotFoundError) {
      console.log(chalk.yellow(`404: ${request.method} ${request.url}`));
      if (wantsJSON) {
        return new Response(JSON.stringify({ error: `Not Found: ${request.url}` }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(`<div class="text-yellow-500">Not Found: ${request.url}</div>`, {
        status: 404,
        headers: { 'Content-Type': 'text/html' },
      });
    }

    if ('code' in error && error.code === 'VALIDATION') {
      console.log('Validation error details:', error);
      console.log('Request URL:', request.url);
      console.log('Request method:', request.method);
      const errorMessage = error instanceof Error ? error.message : 'Validation Error';
      if (wantsJSON) {
        return new Response(JSON.stringify({ error: errorMessage }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(`<div class="text-orange-500">Validation Error: ${errorMessage}</div>`, {
        status: 400,
        headers: { 'Content-Type': 'text/html' },
      });
    }

    if ('code' in error && error.code === 'PARSE') {
      const errorMessage = error instanceof Error ? error.message : 'Parse Error';
      if (wantsJSON) {
        return new Response(JSON.stringify({ error: errorMessage }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(`<div class="text-red-500">Parse Error: ${errorMessage}</div>`, {
        status: 400,
        headers: { 'Content-Type': 'text/html' },
      });
    }

    console.error(chalk.red(`Error: ${request.method} ${request.url}`), error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    const debug = process.env.DEBUG === 'true';
    const responsePayload = debug
      ? { error: errorMessage, stack: error instanceof Error ? error.stack : undefined }
      : { error: errorMessage };

    if (wantsJSON) {
      return new Response(JSON.stringify(responsePayload), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(`<div class="text-red-500">Server error: ${errorMessage}</div>`, {
      status: 500,
      headers: { 'Content-Type': 'text/html' },
    });
  })
  .group('/social', (app) => app.use(socialRoutes))
  .use(analyticsRoutes)
  .use(healthRoutes)
  .use(queryRoutes)
  .use(transactionRoutes)
  .use(chartRoutes);

// Function to start listening after any async initialization
async function start() {
  console.log(chalk.magenta('BMAP API'), chalk.cyan('initializing machine...'));
  await client.connect();

  app.listen({ port: API_PORT, hostname: API_HOST }, () => {
    console.log(chalk.magenta('BMAP API'), chalk.green(`listening on ${API_HOST}:${API_PORT}!`));
  });
}

start();
