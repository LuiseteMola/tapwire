import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serveStatic } from '@hono/node-server/serve-static';
import type { TapwireEngine } from './engine';
import type { SseEmitter } from './sse-emitter';
import { registerInterceptorRoutes } from './routes/interceptor';
import { registerAdminRoutes } from './routes/admin';

export interface ServerDeps {
  engine: TapwireEngine;
  sseEmitter: SseEmitter;
}

const DEBUG = process.env.TAPWIRE_DEBUG === 'true';
const log = (...args: unknown[]) => { if (DEBUG) console.log(...args); };

export function createServer(deps: ServerDeps): Hono {
  const { engine, sseEmitter } = deps;

  const app = new Hono();

  // ---------------------------------------------------------------------------
  // Middleware
  // ---------------------------------------------------------------------------

  app.use('*', async (c, next) => {
    if (c.req.path !== '/resolve' && c.req.path !== '/health') {
      log(`[tapwire] ${c.req.method} ${c.req.path}`);
    }
    await next();
  });

  app.use('*', cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'x-tapwire-internal'],
  }));

  // ---------------------------------------------------------------------------
  // Routes
  // ---------------------------------------------------------------------------

  registerInterceptorRoutes(app, engine);
  registerAdminRoutes(app, { engine, sseEmitter });

  // ---------------------------------------------------------------------------
  // UI — static files (production build) + SPA fallback
  // ---------------------------------------------------------------------------

  const uiDist = path.resolve(__dirname, 'ui');

  const indexHtmlPath = path.join(uiDist, 'index.html');
  const indexHtml = existsSync(indexHtmlPath) ? readFileSync(indexHtmlPath, 'utf-8') : null;

  app.get('/*', serveStatic({ root: path.relative(process.cwd(), uiDist) }));

  app.get('*', (c) => {
    if (!indexHtml) return c.body(null, 404);
    return c.html(indexHtml);
  });

  return app;
}
