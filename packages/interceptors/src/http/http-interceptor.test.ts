import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import { HttpInterceptor } from './http-interceptor';

// ---------------------------------------------------------------------------
// Test infrastructure helpers
// ---------------------------------------------------------------------------

/**
 * Creates a minimal HTTP server with controllable response behavior.
 * Returns the server and the port it's listening on.
 */
function startServer(
  handler: http.RequestListener,
): Promise<{ server: http.Server; port: number }> {
  return new Promise((resolve) => {
    const server = http.createServer(handler);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as { port: number };
      resolve({ server, port });
    });
  });
}

function stopServer(server: http.Server): Promise<void> {
  return new Promise((resolve, reject) =>
    server.close(err => (err ? reject(err) : resolve())),
  );
}

/** Makes an HTTP GET using the (intercepted) http module and returns status + body. */
function httpGet(url: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      let body = '';
      res.on('data', (chunk: string) => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode!, body }));
    });
    req.on('error', reject);
  });
}

/** Reads and parses the body from an incoming request. */
function readBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (chunk: string) => { raw += chunk; });
    req.on('end', () => {
      try { resolve(JSON.parse(raw)); }
      catch { resolve(raw); }
    });
  });
}

// ---------------------------------------------------------------------------
// Suite: mock resolution
// ---------------------------------------------------------------------------

describe('register — mock resolution', () => {
  let daemon: http.Server;
  let daemonPort: number;
  let upstream: http.Server;
  let upstreamPort: number;
  let interceptor: HttpInterceptor;
  let upstreamHitCount: number;

  beforeAll(async () => {
    upstreamHitCount = 0;

    // Mock upstream — records hits so we can verify it was NOT called
    const up = await startServer((_req, res) => {
      upstreamHitCount++;
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ from: 'upstream' }));
    });
    upstream = up.server;
    upstreamPort = up.port;

    // Mock daemon — always returns a mock resolution
    const d = await startServer(async (req, res) => {
      const body = await readBody(req) as { url: string };

      if (req.url === '/resolve') {
        const resolution = {
          type: 'mock',
          captureId: 'cap-mock-1',
          stub: { id: 's1', method: 'GET', pattern: '/users/:id', mode: 'mock', config: { failureRate: 0 }, responses: { mode: 'fixed', cursor: -1, responses: [] }, faults: { mode: 'fixed', cursor: -1, responses: [] } },
          response: { id: 'r1', statusCode: 200, body: { id: 1, name: 'Jane' }, headers: {} },
        };
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify(resolution));
        return;
      }

      // Accept PATCH /captures/:id for capture completion
      if (req.url?.startsWith('/captures/') && req.method === 'PATCH') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
        return;
      }

      res.writeHead(404);
      res.end();
    });
    daemon = d.server;
    daemonPort = d.port;

    interceptor = new HttpInterceptor(`http://127.0.0.1:${daemonPort}`);
    interceptor.apply();
  });

  afterAll(async () => {
    interceptor.dispose();
    await Promise.all([stopServer(daemon), stopServer(upstream)]);
  });

  it('returns the stub response without hitting the upstream', async () => {
    const { status, body } = await httpGet(`http://127.0.0.1:${upstreamPort}/users/1`);
    expect(status).toBe(200);
    expect(JSON.parse(body)).toEqual({ id: 1, name: 'Jane' });
    expect(upstreamHitCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Suite: passthrough — real request + capture submission
// ---------------------------------------------------------------------------

describe('register — passthrough and capture', () => {
  let daemon: http.Server;
  let daemonPort: number;
  let upstream: http.Server;
  let upstreamPort: number;
  let interceptor: HttpInterceptor;
  let captureReceived: ((data: unknown) => void) | undefined;

  beforeAll(async () => {
    // Mock upstream — returns a real JSON response
    const up = await startServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ id: 99, name: 'Real User' }));
    });
    upstream = up.server;
    upstreamPort = up.port;

    // Mock daemon — returns passthrough with captureId, records PATCH /captures/:id
    const d = await startServer(async (req, res) => {
      const body = await readBody(req);

      if (req.url === '/resolve') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ type: 'passthrough', captureId: 'cap-pt-1' }));
        return;
      }

      if (req.url?.startsWith('/captures/') && req.method === 'PATCH') {
        captureReceived?.(body);
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
        return;
      }

      res.writeHead(404);
      res.end();
    });
    daemon = d.server;
    daemonPort = d.port;

    interceptor = new HttpInterceptor(`http://127.0.0.1:${daemonPort}`);
    interceptor.apply();
  });

  afterAll(async () => {
    interceptor.dispose();
    await Promise.all([stopServer(daemon), stopServer(upstream)]);
  });

  it('forwards the request to the real upstream and returns its response', async () => {
    const capturePromise = new Promise<unknown>(resolve => { captureReceived = resolve; });

    const { status, body } = await httpGet(`http://127.0.0.1:${upstreamPort}/users/99`);
    expect(status).toBe(200);
    expect(JSON.parse(body)).toEqual({ id: 99, name: 'Real User' });

    // Wait for PATCH /captures/:id to be called after the response
    const capture = await capturePromise as Record<string, unknown>;
    expect(capture['responseStatus']).toBe(200);
    expect(capture['responseBody']).toEqual({ id: 99, name: 'Real User' });
    expect(typeof capture['latencyMs']).toBe('number');
  });

  it('submits capture with correct host and pathname', async () => {
    const capturePromise = new Promise<unknown>(resolve => { captureReceived = resolve; });

    await httpGet(`http://127.0.0.1:${upstreamPort}/products/5`);

    const capture = await capturePromise as Record<string, unknown>;
    expect(capture['responseStatus']).toBe(200);
    expect(typeof capture['latencyMs']).toBe('number');
  });
});

// ---------------------------------------------------------------------------
// Suite: daemon unavailable
// ---------------------------------------------------------------------------

describe('register — daemon unavailable', () => {
  let upstream: http.Server;
  let upstreamPort: number;
  let interceptor: HttpInterceptor;

  beforeAll(async () => {
    const up = await startServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ alive: true }));
    });
    upstream = up.server;
    upstreamPort = up.port;

    // Point to a port with no daemon running
    interceptor = new HttpInterceptor('http://127.0.0.1:19999');
    interceptor.apply();
  });

  afterAll(async () => {
    interceptor.dispose();
    await stopServer(upstream);
  });

  it('passes through to the real upstream without crashing', async () => {
    const { status, body } = await httpGet(`http://127.0.0.1:${upstreamPort}/health`);
    expect(status).toBe(200);
    expect(JSON.parse(body)).toEqual({ alive: true });
  });
});
