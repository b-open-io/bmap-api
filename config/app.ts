import { cors } from '@elysiajs/cors';
import { staticPlugin } from '@elysiajs/static';
import { swagger } from '@elysiajs/swagger';
import chalk from 'chalk';
import { Elysia, NotFoundError } from 'elysia';
import { errorHandlerPlugin } from '../middleware/errorHandler.js';
import { swaggerConfig } from './swagger.js';

export function createApp() {
  return new Elysia()
    .use(errorHandlerPlugin)
    .use(cors())
    .use(staticPlugin({ assets: './public', prefix: '/' }))
    .use(swagger(swaggerConfig))
    // Derived context, e.g. SSE request timeout
    .derive(() => ({
      requestTimeout: 0,
    }))
    // Lifecycle hooks
    .onRequest(({ request }) => {
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
        return new Response(`Not Found: ${request.url}`, {
          status: 404,
          headers: { 'Content-Type': 'text/plain' },
        });
      }

      const message = (error as any).message || 'Internal Server Error';
      const code = 'code' in error ? error.code : 'INTERNAL_SERVER_ERROR';

      if (wantsJSON) {
        return new Response(
          JSON.stringify({
            error: message,
            code,
            details: error instanceof Error ? error.stack : undefined,
          }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      return new Response(message, {
        status: 500,
        headers: { 'Content-Type': 'text/plain' },
      });
    });
}