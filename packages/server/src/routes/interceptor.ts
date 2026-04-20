import type { Hono } from 'hono';
import type { TapwireEngine, ResolveResult } from '../engine';
import type { HttpMethod, BodyCaptureStatus, CaptureServedStatus, CapturedNetworkError, StackFrame } from '@tapwire/shared';

const DEBUG = process.env.TAPWIRE_DEBUG === 'true';
const log = (...args: unknown[]) => { if (DEBUG) console.log(...args); };

function createTag(resolution: ResolveResult): string {
  switch (resolution.type) {
    case 'mock':
      return `mock     ${resolution.stub.method} ${resolution.stub.pattern}`;
    case 'network-error':
      return `net-err  ${resolution.stub.method} ${resolution.stub.pattern} (${resolution.errorCode})`;
    case 'proxy':
      return `proxy    ${resolution.stub.method} ${resolution.stub.pattern}`;
    case 'record':
      return `record   ${resolution.stub.method} ${resolution.stub.pattern}`;
    default:
      return 'pass';
  }
}

export function registerInterceptorRoutes(app: Hono, engine: TapwireEngine): void {

  app.post('/resolve', async (c) => {
    if (!c.req.header('x-tapwire-internal')) {
      return c.body(null, 403);
    }

    const { method, url, requestHeaders, requestBody, initiator } = await c.req.json() as {
      method: HttpMethod;
      url: string;
      requestHeaders: Record<string, string>;
      requestBody?: unknown;
      initiator?: StackFrame[];
    };

    const resolution = engine.resolve({ method, url, requestHeaders, requestBody, initiator });

    const pathname = (() => { try { return new URL(url).pathname; } catch { return url; } })();
    log(`[tapwire] ${method.padEnd(7)} ${pathname} → ${createTag(resolution)}`);

    return c.json(resolution);
  });

  app.patch('/captures/:id', async (c) => {
    const input = await c.req.json() as {
      served: Exclude<CaptureServedStatus, 'in-flight'>;
      responseStatus: number;
      responseHeaders: Record<string, string>;
      responseBody: unknown;
      latencyMs: number;
      bodyCaptured?: BodyCaptureStatus;
      networkError?: CapturedNetworkError;
    };

    const result = engine.completeCapture(c.req.param('id'), input);
    if (!result) return c.body(null, 404);

    return c.json(result);
  });
}
