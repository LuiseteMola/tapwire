import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { Hono } from 'hono';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { bootstrap } from './bootstrap';
import type { TapwireConfig } from '@tapwire/shared';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let tmpDir: string;
let app: Awaited<ReturnType<typeof bootstrap>>['app'];

function makeConfig(overrides: Partial<TapwireConfig> = {}): TapwireConfig {
  return {
    port: 4000,
    fixturesDir: tmpDir,
    mode: 'default' as const,
    captureInitiator: true,
    scrub: {
      headers: ['authorization', 'cookie', 'x-api-key'],
      replaceWith: '[REDACTED]',
    },
    capture: {
      maxBodySize: '10mb',
    },
    ...overrides,
  };
}

/** Send a JSON request to the Hono app. */
async function json(
  testApp: Hono,
  method: string,
  urlPath: string,
  opts: { body?: unknown; headers?: Record<string, string> } = {},
) {
  const init: RequestInit = { method };
  const headers: Record<string, string> = { ...opts.headers };
  if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(opts.body);
  }
  init.headers = headers;
  const res = await testApp.request(urlPath, init);
  return res;
}

/** Parse response body as JSON (convenience). */
async function bodyOf(res: Response) {
  return res.json();
}

const sampleCapture = {
  method: 'GET' as const,
  url: 'https://jsonplaceholder.typicode.com/users/1',
  host: 'jsonplaceholder.typicode.com',
  pathname: '/users/1',
  requestHeaders: { authorization: 'Bearer secret', 'content-type': 'application/json' },
  requestBody: null,
  responseStatus: 200,
  responseHeaders: { 'content-type': 'application/json' },
  responseBody: { id: 1, name: 'Jane Doe' },
  latencyMs: 45,
  capturedAt: new Date().toISOString(),
};

/**
 * Creates a completed capture through the in-flight flow:
 * 1. POST /resolve → creates pending capture, returns captureId
 * 2. PATCH /captures/:id → completes with response data
 */
async function createCompletedCapture(testApp: typeof app, data = sampleCapture) {
  const resolveRes = await json(testApp, 'POST', '/resolve', {
    body: {
      method: data.method,
      url: data.url,
      requestHeaders: data.requestHeaders,
      requestBody: data.requestBody,
    },
    headers: { 'x-tapwire-internal': 'true' },
  });

  const resolveBody = await bodyOf(resolveRes);
  const captureId = resolveBody.captureId;

  await json(testApp, 'PATCH', `/captures/${captureId}`, {
    body: {
      served: 'served',
      responseStatus: data.responseStatus,
      responseHeaders: data.responseHeaders,
      responseBody: data.responseBody,
      latencyMs: data.latencyMs,
    },
  });

  return captureId;
}

beforeEach(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tapwire-server-test-'));
  const { app: testApp } = await bootstrap(makeConfig());
  app = testApp;
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------

describe('GET /health', () => {
  it('returns 200 with status ok', async () => {
    const res = await app.request('/health');
    expect(res.status).toBe(200);
    const body = await bodyOf(res);
    expect(body.status).toBe('ok');
    expect(typeof body.stubCount).toBe('number');
    expect(typeof body.captureCount).toBe('number');
  });

  it('reports dirty: false initially', async () => {
    const res = await app.request('/health');
    const body = await bodyOf(res);
    expect(body.dirty).toBe(false);
  });

  it('reports dirty: true after a mutation', async () => {
    await json(app, 'POST', '/stubs', {
      body: { method: 'GET', host: 'api.example.com', pattern: '/test' },
    });
    const res = await app.request('/health');
    const body = await bodyOf(res);
    expect(body.dirty).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// /resolve
// ---------------------------------------------------------------------------

describe('POST /resolve', () => {
  it('returns 403 without x-tapwire-internal header', async () => {
    const res = await json(app, 'POST', '/resolve', {
      body: {
        method: 'GET',
        url: 'https://api.example.com/users/1',
        requestHeaders: {},
      },
    });
    expect(res.status).toBe(403);
  });

  it('returns passthrough when no stub matches', async () => {
    const res = await json(app, 'POST', '/resolve', {
      body: { method: 'GET', url: 'https://api.example.com/users/1', requestHeaders: {} },
      headers: { 'x-tapwire-internal': 'true' },
    });

    expect(res.status).toBe(200);
    const body = await bodyOf(res);
    expect(body.type).toBe('passthrough');
    expect(typeof body.captureId).toBe('string');
  });

  it('creates a pending capture in the inbox', async () => {
    const res = await json(app, 'POST', '/resolve', {
      body: { method: 'GET', url: 'https://api.example.com/users/1', requestHeaders: {} },
      headers: { 'x-tapwire-internal': 'true' },
    });

    const resBody = await bodyOf(res);
    const capture = await app.request(`/captures/${resBody.captureId}`);
    expect(capture.status).toBe(200);
    const captureBody = await bodyOf(capture);
    expect(captureBody.served).toBe('in-flight');
    expect(captureBody.resolutionType).toBe('passthrough');
  });

  it('returns mock resolution when a stub matches', async () => {
    const captureId = await createCompletedCapture(app);

    await json(app, 'POST', `/captures/${captureId}/promote`, {
      body: { captureId, pattern: '/users/:id', method: 'GET', host: 'jsonplaceholder.typicode.com' },
    });

    const res = await json(app, 'POST', '/resolve', {
      body: {
        method: 'GET',
        url: 'https://jsonplaceholder.typicode.com/users/1',
        requestHeaders: {},
      },
      headers: { 'x-tapwire-internal': 'true' },
    });

    expect(res.status).toBe(200);
    const body = await bodyOf(res);
    expect(body.type).toBe('mock');
    expect(body.response.statusCode).toBe(200);
    expect(typeof body.captureId).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// Captures
// ---------------------------------------------------------------------------

describe('GET /captures', () => {
  it('returns empty array initially', async () => {
    const res = await app.request('/captures');
    expect(res.status).toBe(200);
    const body = await bodyOf(res);
    expect(body).toEqual([]);
  });
});

describe('PATCH /captures/:id', () => {
  it('completes a pending capture with response data', async () => {
    const resolveRes = await json(app, 'POST', '/resolve', {
      body: { method: 'GET', url: sampleCapture.url, requestHeaders: sampleCapture.requestHeaders },
      headers: { 'x-tapwire-internal': 'true' },
    });

    const resolveBody = await bodyOf(resolveRes);
    const captureId = resolveBody.captureId;

    const res = await json(app, 'PATCH', `/captures/${captureId}`, {
      body: {
        served: 'served',
        responseStatus: 200,
        responseHeaders: { 'content-type': 'application/json' },
        responseBody: { id: 1 },
        latencyMs: 42,
      },
    });

    expect(res.status).toBe(200);
    const body = await bodyOf(res);
    expect(body.served).toBe('served');
    expect(body.responseStatus).toBe(200);
    expect(body.latencyMs).toBe(42);
  });

  it('returns 404 for unknown id', async () => {
    const res = await json(app, 'PATCH', '/captures/nonexistent', { body: {} });
    expect(res.status).toBe(404);
  });
});

describe('GET /captures/:id', () => {
  it('returns the capture by id', async () => {
    const captureId = await createCompletedCapture(app);
    const res = await app.request(`/captures/${captureId}`);
    expect(res.status).toBe(200);
    const body = await bodyOf(res);
    expect(body.id).toBe(captureId);
    expect(body.served).toBe('served');
  });

  it('returns 404 for unknown id', async () => {
    const res = await app.request('/captures/nonexistent');
    expect(res.status).toBe(404);
  });
});

describe('DELETE /captures', () => {
  it('clears all captures', async () => {
    await createCompletedCapture(app);
    await app.request('/captures', { method: 'DELETE' });
    const res = await app.request('/captures');
    const body = await bodyOf(res);
    expect(body).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Promote
// ---------------------------------------------------------------------------

describe('POST /captures/:id/promote', () => {
  it('creates a stub from a capture', async () => {
    const captureId = await createCompletedCapture(app);
    const res = await json(app, 'POST', `/captures/${captureId}/promote`, {
      body: { captureId, pattern: '/users/:id', method: 'GET', host: 'jsonplaceholder.typicode.com' },
    });

    expect(res.status).toBe(201);
    const body = await bodyOf(res);
    expect(body.pattern).toBe('/users/:id');
    expect(body.method).toBe('GET');
  });

  it('scrubs authorization header from the promoted stub', async () => {
    const captureId = await createCompletedCapture(app);
    await json(app, 'POST', `/captures/${captureId}/promote`, {
      body: { captureId, pattern: '/users/:id', method: 'GET', host: 'jsonplaceholder.typicode.com' },
    });

    const stubs = await app.request('/stubs');
    const stubsBody = await bodyOf(stubs);
    const stub = stubsBody[0];
    expect(stub.responses.responses[0].headers['authorization']).toBeUndefined();
  });

  it('marks the capture as promoted in the inbox', async () => {
    const captureId = await createCompletedCapture(app);
    await json(app, 'POST', `/captures/${captureId}/promote`, {
      body: { captureId, pattern: '/users/:id', method: 'GET', host: 'jsonplaceholder.typicode.com' },
    });

    const updated = await app.request(`/captures/${captureId}`);
    const body = await bodyOf(updated);
    expect(body.promoted).toBe(true);
  });

  it('does not persist to disk until save is called', async () => {
    const captureId = await createCompletedCapture(app);
    const promoted = await json(app, 'POST', `/captures/${captureId}/promote`, {
      body: { captureId, pattern: '/users/:id', method: 'GET', host: 'jsonplaceholder.typicode.com' },
    });

    const promotedBody = await bodyOf(promoted);
    const filePath = path.join(tmpDir, `${promotedBody.id}.json`);
    expect(fs.existsSync(filePath)).toBe(false);

    // After save, file should exist
    await app.request('/save', { method: 'POST' });
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it('returns 404 for unknown capture id', async () => {
    const res = await json(app, 'POST', '/captures/nonexistent/promote', {
      body: { captureId: 'nonexistent', pattern: '/users/:id', method: 'GET' },
    });
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// Stubs
// ---------------------------------------------------------------------------

describe('GET /stubs', () => {
  it('returns empty array initially', async () => {
    const res = await app.request('/stubs');
    expect(res.status).toBe(200);
    const body = await bodyOf(res);
    expect(body).toEqual([]);
  });
});

describe('PATCH /stubs/:id', () => {
  it('updates the stub mode', async () => {
    const captureId = await createCompletedCapture(app);
    const promoted = await json(app, 'POST', `/captures/${captureId}/promote`, {
      body: { captureId, pattern: '/users/:id', method: 'GET', host: 'jsonplaceholder.typicode.com' },
    });
    const promotedBody = await bodyOf(promoted);

    const res = await json(app, 'PATCH', `/stubs/${promotedBody.id}`, {
      body: { mode: 'proxy' },
    });

    expect(res.status).toBe(200);
    const body = await bodyOf(res);
    expect(body.mode).toBe('proxy');
  });

  it('returns 404 for unknown stub id', async () => {
    const res = await json(app, 'PATCH', '/stubs/nonexistent', { body: { mode: 'proxy' } });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /stubs/:id', () => {
  it('removes the stub', async () => {
    const captureId = await createCompletedCapture(app);
    const promoted = await json(app, 'POST', `/captures/${captureId}/promote`, {
      body: { captureId, pattern: '/users/:id', method: 'GET', host: 'jsonplaceholder.typicode.com' },
    });
    const promotedBody = await bodyOf(promoted);

    await app.request(`/stubs/${promotedBody.id}`, { method: 'DELETE' });

    const res = await app.request('/stubs');
    const body = await bodyOf(res);
    expect(body).toHaveLength(0);
  });

  it('returns 404 for unknown stub id', async () => {
    const res = await app.request('/stubs/nonexistent', { method: 'DELETE' });
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// Stub responses
// ---------------------------------------------------------------------------

describe('POST /stubs/:id/responses', () => {
  it('appends a response to the responses pool with a generated id', async () => {
    const captureId = await createCompletedCapture(app);
    const promoted = await json(app, 'POST', `/captures/${captureId}/promote`, {
      body: { captureId, pattern: '/users/:id', method: 'GET', host: 'jsonplaceholder.typicode.com' },
    });
    const promotedBody = await bodyOf(promoted);

    const res = await json(app, 'POST', `/stubs/${promotedBody.id}/responses`, {
      body: {
        statusCode: 200,
        body: { id: 2, name: 'John' },
        headers: { 'content-type': 'application/json' },
        pool: 'responses',
      },
    });

    expect(res.status).toBe(201);
    const body = await bodyOf(res);
    expect(body.responses.responses).toHaveLength(2);
    expect(typeof body.responses.responses[1].id).toBe('string');
  });
});

describe('DELETE /stubs/:id/responses/:responseId', () => {
  it('removes the response from the pool', async () => {
    const captureId = await createCompletedCapture(app);
    const promoted = await json(app, 'POST', `/captures/${captureId}/promote`, {
      body: { captureId, pattern: '/users/:id', method: 'GET', host: 'jsonplaceholder.typicode.com' },
    });
    const promotedBody = await bodyOf(promoted);
    const responseId = promotedBody.responses.responses[0].id;

    const res = await app.request(`/stubs/${promotedBody.id}/responses/${responseId}`, { method: 'DELETE' });

    expect(res.status).toBe(200);
    const body = await bodyOf(res);
    expect(body.responses.responses).toHaveLength(0);
  });

  it('returns 404 for unknown response id', async () => {
    const captureId = await createCompletedCapture(app);
    const promoted = await json(app, 'POST', `/captures/${captureId}/promote`, {
      body: { captureId, pattern: '/users/:id', method: 'GET', host: 'jsonplaceholder.typicode.com' },
    });
    const promotedBody = await bodyOf(promoted);

    const res = await app.request(`/stubs/${promotedBody.id}/responses/nonexistent`, { method: 'DELETE' });
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// Reset
// ---------------------------------------------------------------------------

describe('POST /reset', () => {
  it('clears the inbox', async () => {
    await createCompletedCapture(app);
    await app.request('/reset', { method: 'POST' });
    const res = await app.request('/captures');
    const body = await bodyOf(res);
    expect(body).toHaveLength(0);
  });

  it('reloads stubs from disk (discards unsaved changes)', async () => {
    const captureId = await createCompletedCapture(app);
    await json(app, 'POST', `/captures/${captureId}/promote`, {
      body: { captureId, pattern: '/users/:id', method: 'GET', host: 'jsonplaceholder.typicode.com' },
    });

    // Save to disk
    await app.request('/save', { method: 'POST' });

    // Create another stub (unsaved)
    await json(app, 'POST', '/stubs', {
      body: { method: 'POST', host: 'api.example.com', pattern: '/orders' },
    });
    const beforeReset = await app.request('/stubs');
    const beforeResetBody = await bodyOf(beforeReset);
    expect(beforeResetBody).toHaveLength(2);

    // Reset should discard the unsaved stub
    await app.request('/reset', { method: 'POST' });
    const afterReset = await app.request('/stubs');
    const afterResetBody = await bodyOf(afterReset);
    expect(afterResetBody).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Save / Load
// ---------------------------------------------------------------------------

describe('POST /save', () => {
  it('persists stubs to disk', async () => {
    await json(app, 'POST', '/stubs', {
      body: { method: 'GET', host: 'api.example.com', pattern: '/items' },
    });

    const saveRes = await app.request('/save', { method: 'POST' });
    expect(saveRes.status).toBe(200);

    const files = fs.readdirSync(tmpDir).filter(f => f.endsWith('.json'));
    expect(files).toHaveLength(1);
  });

  it('clears dirty flag after save', async () => {
    await json(app, 'POST', '/stubs', {
      body: { method: 'GET', host: 'api.example.com', pattern: '/items' },
    });

    let health = await bodyOf(await app.request('/health'));
    expect(health.dirty).toBe(true);

    await app.request('/save', { method: 'POST' });

    health = await bodyOf(await app.request('/health'));
    expect(health.dirty).toBe(false);
  });

  it('deletes orphaned files on save', async () => {
    // Create and save two stubs
    const res1 = await json(app, 'POST', '/stubs', {
      body: { method: 'GET', host: 'api.example.com', pattern: '/a' },
    });
    const stub1 = await bodyOf(res1);
    await json(app, 'POST', '/stubs', {
      body: { method: 'GET', host: 'api.example.com', pattern: '/b' },
    });
    await app.request('/save', { method: 'POST' });
    expect(fs.readdirSync(tmpDir).filter(f => f.endsWith('.json'))).toHaveLength(2);

    // Delete one stub and save again
    await app.request(`/stubs/${stub1.id}`, { method: 'DELETE' });
    await app.request('/save', { method: 'POST' });
    expect(fs.readdirSync(tmpDir).filter(f => f.endsWith('.json'))).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Reorder responses
// ---------------------------------------------------------------------------

describe('PUT /stubs/:id/responses/order', () => {
  it('reorders responses in the pool', async () => {
    const captureId = await createCompletedCapture(app);
    const promoted = await json(app, 'POST', `/captures/${captureId}/promote`, {
      body: { captureId, pattern: '/users/:id', method: 'GET', host: 'jsonplaceholder.typicode.com' },
    });
    const stub = await bodyOf(promoted);

    // Add a second response
    const addRes = await json(app, 'POST', `/stubs/${stub.id}/responses`, {
      body: { statusCode: 201, body: { id: 2 }, headers: {}, pool: 'responses' },
    });
    const updatedStub = await bodyOf(addRes);
    const [r1, r2] = updatedStub.responses.responses;

    // Reorder: swap
    const res = await json(app, 'PUT', `/stubs/${stub.id}/responses/order`, {
      body: { pool: 'responses', order: [r2.id, r1.id] },
    });

    expect(res.status).toBe(200);
    const reordered = await bodyOf(res);
    expect(reordered.responses.responses[0].id).toBe(r2.id);
    expect(reordered.responses.responses[1].id).toBe(r1.id);
  });

  it('returns 404 for unknown stub id', async () => {
    const res = await json(app, 'PUT', '/stubs/nonexistent/responses/order', {
      body: { pool: 'responses', order: [] },
    });
    expect(res.status).toBe(404);
  });

  it('returns 404 when order IDs do not match', async () => {
    const captureId = await createCompletedCapture(app);
    const promoted = await json(app, 'POST', `/captures/${captureId}/promote`, {
      body: { captureId, pattern: '/users/:id', method: 'GET', host: 'jsonplaceholder.typicode.com' },
    });
    const stub = await bodyOf(promoted);

    const res = await json(app, 'PUT', `/stubs/${stub.id}/responses/order`, {
      body: { pool: 'responses', order: ['nonexistent-id'] },
    });
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// Reset cursor
// ---------------------------------------------------------------------------

describe('POST /stubs/:id/cursor/reset', () => {
  it('resets the cursor to -1', async () => {
    const captureId = await createCompletedCapture(app);
    const promoted = await json(app, 'POST', `/captures/${captureId}/promote`, {
      body: { captureId, pattern: '/users/:id', method: 'GET', host: 'jsonplaceholder.typicode.com' },
    });
    const stub = await bodyOf(promoted);

    const res = await json(app, 'POST', `/stubs/${stub.id}/cursor/reset`, {
      body: { pool: 'responses' },
    });

    expect(res.status).toBe(200);
    const updated = await bodyOf(res);
    expect(updated.responses.cursor).toBe(-1);
  });

  it('returns 404 for unknown stub id', async () => {
    const res = await json(app, 'POST', '/stubs/nonexistent/cursor/reset', {
      body: { pool: 'responses' },
    });
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// Server settings
// ---------------------------------------------------------------------------

describe('GET /settings', () => {
  it('returns default settings', async () => {
    const res = await app.request('/settings');
    expect(res.status).toBe(200);
    const body = await bodyOf(res);
    expect(body.mode).toBe('default');
    expect(body.strict).toBe(false);
  });
});

describe('PATCH /settings', () => {
  it('updates server mode', async () => {
    const res = await json(app, 'PATCH', '/settings', {
      body: { mode: 'mock' },
    });
    expect(res.status).toBe(200);
    const body = await bodyOf(res);
    expect(body.mode).toBe('mock');
    expect(body.strict).toBe(false);
  });

  it('updates strict toggle', async () => {
    await json(app, 'PATCH', '/settings', { body: { mode: 'mock' } });
    const res = await json(app, 'PATCH', '/settings', { body: { strict: true } });
    const body = await bodyOf(res);
    expect(body.mode).toBe('mock');
    expect(body.strict).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Server mode behavior
// ---------------------------------------------------------------------------

describe('Server mode: mock', () => {
  it('forces mock resolution on a proxy-mode stub', async () => {
    // Create a stub in proxy mode
    const captureId = await createCompletedCapture(app);
    const promoted = await json(app, 'POST', `/captures/${captureId}/promote`, {
      body: { captureId, pattern: '/users/:id', method: 'GET', host: 'jsonplaceholder.typicode.com' },
    });
    const stub = await bodyOf(promoted);
    await json(app, 'PATCH', `/stubs/${stub.id}`, { body: { mode: 'proxy' } });

    // Set server mode to mock
    await json(app, 'PATCH', '/settings', { body: { mode: 'mock' } });

    // Resolve — should get mock, not proxy
    const res = await json(app, 'POST', '/resolve', {
      body: { method: 'GET', url: 'https://jsonplaceholder.typicode.com/users/1', requestHeaders: {} },
      headers: { 'x-tapwire-internal': 'true' },
    });
    const body = await bodyOf(res);
    expect(body.type).toBe('mock');
  });
});

describe('Server mode: mock + strict', () => {
  it('rejects unmatched requests with 501', async () => {
    await json(app, 'PATCH', '/settings', { body: { mode: 'mock', strict: true } });

    const res = await json(app, 'POST', '/resolve', {
      body: { method: 'GET', url: 'https://unknown-api.com/data', requestHeaders: {} },
      headers: { 'x-tapwire-internal': 'true' },
    });
    const body = await bodyOf(res);
    expect(body.type).toBe('rejected');
    expect(body.statusCode).toBe(501);
  });
});

describe('Server mode: record', () => {
  it('forces record resolution on a mock-mode stub', async () => {
    const captureId = await createCompletedCapture(app);
    await json(app, 'POST', `/captures/${captureId}/promote`, {
      body: { captureId, pattern: '/users/:id', method: 'GET', host: 'jsonplaceholder.typicode.com' },
    });

    await json(app, 'PATCH', '/settings', { body: { mode: 'record' } });

    const res = await json(app, 'POST', '/resolve', {
      body: { method: 'GET', url: 'https://jsonplaceholder.typicode.com/users/1', requestHeaders: {} },
      headers: { 'x-tapwire-internal': 'true' },
    });
    const body = await bodyOf(res);
    expect(body.type).toBe('record');
  });

  it('auto-promotes passthrough captures in record + passthrough mode', async () => {
    await json(app, 'PATCH', '/settings', { body: { mode: 'record', strict: false } });

    // Create a passthrough capture
    const captureId = await createCompletedCapture(app, {
      ...sampleCapture,
      url: 'https://new-api.example.com/items/42',
      host: 'new-api.example.com',
      pathname: '/items/42',
    });

    // Should have auto-promoted
    const stubs = await bodyOf(await app.request('/stubs'));
    const autoStub = stubs.find((s: any) => s.host === 'new-api.example.com');
    expect(autoStub).toBeDefined();
    expect(autoStub.pattern).toBe('/items/42');
  });
});

describe('Server mode: record + strict', () => {
  it('rejects unmatched requests', async () => {
    await json(app, 'PATCH', '/settings', { body: { mode: 'record', strict: true } });

    const res = await json(app, 'POST', '/resolve', {
      body: { method: 'GET', url: 'https://unknown-api.com/data', requestHeaders: {} },
      headers: { 'x-tapwire-internal': 'true' },
    });
    const body = await bodyOf(res);
    expect(body.type).toBe('rejected');
  });
});

describe('POST /load', () => {
  it('reloads state from disk', async () => {
    // Create and save a stub
    await json(app, 'POST', '/stubs', {
      body: { method: 'GET', host: 'api.example.com', pattern: '/items' },
    });
    await app.request('/save', { method: 'POST' });

    // Create another stub (not saved)
    await json(app, 'POST', '/stubs', {
      body: { method: 'POST', host: 'api.example.com', pattern: '/orders' },
    });
    let stubs = await bodyOf(await app.request('/stubs'));
    expect(stubs).toHaveLength(2);

    // Load should discard the unsaved stub
    await app.request('/load', { method: 'POST' });
    stubs = await bodyOf(await app.request('/stubs'));
    expect(stubs).toHaveLength(1);
  });
});
