import type { Hono } from 'hono';
import { stream } from 'hono/streaming';
import type { TapwireEngine } from '../engine';
import type { SseEmitter, SseWriter } from '../sse-emitter';
import type { HttpMethod, PromoteRequest, ServerSettings, StubResponse } from '@tapwire/shared';

const VERSION = '0.1.0';

export interface AdminRouteDeps {
  engine: TapwireEngine;
  sseEmitter: SseEmitter;
}

export function registerAdminRoutes(app: Hono, deps: AdminRouteDeps): void {
  const { engine, sseEmitter } = deps;

  // ---------------------------------------------------------------------------
  // Health
  // ---------------------------------------------------------------------------

  app.get('/health', (c) => {
    return c.json({
      status: 'ok',
      version: VERSION,
      stubCount: engine.stubCount,
      captureCount: engine.captureCount,
      dirty: engine.dirty,
      serverMode: engine.serverMode,
      strict: engine.strict,
      autoSave: engine.autoSave,
    });
  });

  // ---------------------------------------------------------------------------
  // Captures
  // ---------------------------------------------------------------------------

  app.get('/captures', (c) => {
    return c.json(engine.getCaptures());
  });

  app.delete('/captures', (c) => {
    engine.clearCaptures();
    return c.body(null, 204);
  });

  app.get('/captures/:id', (c) => {
    const capture = engine.getCapture(c.req.param('id'));
    if (!capture) return c.body(null, 404);
    return c.json(capture);
  });

  app.post('/captures/:id/promote', async (c) => {
    const { pattern, method, host } = await c.req.json() as PromoteRequest;
    const stub = engine.promote(c.req.param('id'), pattern, method, host);
    if (!stub) return c.body(null, 404);
    return c.json(stub, 201);
  });

  app.post('/captures/:id/add-to-stub', async (c) => {
    const { stubId } = await c.req.json() as { stubId: string };
    const stub = engine.addCaptureToStub(c.req.param('id'), stubId);
    if (!stub) return c.body(null, 404);
    return c.json(stub, 201);
  });

  // ---------------------------------------------------------------------------
  // Stubs
  // ---------------------------------------------------------------------------

  app.get('/stubs', (c) => {
    return c.json(engine.getStubs());
  });

  app.post('/stubs', async (c) => {
    const { method, host, pattern, mode } = await c.req.json() as {
      method: HttpMethod;
      host: string;
      pattern: string;
      mode?: string;
    };

    if (!method || !host || !pattern) {
      return c.json({ error: 'method, host, and pattern are required' }, 400);
    }

    const stub = engine.createStub({ method, host, pattern, mode: mode as any });
    return c.json(stub, 201);
  });

  app.get('/stubs/:id', (c) => {
    const stub = engine.getStub(c.req.param('id'));
    if (!stub) return c.body(null, 404);
    return c.json(stub);
  });

  app.patch('/stubs/:id', async (c) => {
    const patch = await c.req.json();
    const updated = engine.updateStub(c.req.param('id'), patch);
    if (!updated) return c.body(null, 404);
    return c.json(updated);
  });

  app.delete('/stubs/:id', (c) => {
    const removed = engine.removeStub(c.req.param('id'));
    if (!removed) return c.body(null, 404);
    return c.body(null, 204);
  });

  // ---------------------------------------------------------------------------
  // Stub responses
  // ---------------------------------------------------------------------------

  app.post('/stubs/:id/responses', async (c) => {
    const { pool = 'responses', ...responseData } = await c.req.json() as Omit<StubResponse, 'id'> & {
      pool?: 'responses' | 'faults';
    };

    const updated = engine.addResponse(c.req.param('id'), pool, responseData);
    if (!updated) return c.body(null, 404);
    return c.json(updated, 201);
  });

  app.patch('/stubs/:id/responses/:responseId', async (c) => {
    const patch = await c.req.json() as Partial<StubResponse>;
    const updated = engine.updateResponse(c.req.param('id'), c.req.param('responseId'), patch);
    if (!updated) return c.body(null, 404);
    return c.json(updated);
  });

  app.delete('/stubs/:id/responses/:responseId', (c) => {
    const updated = engine.removeResponse(c.req.param('id'), c.req.param('responseId'));
    if (!updated) return c.body(null, 404);
    return c.json(updated);
  });

  app.put('/stubs/:id/responses/order', async (c) => {
    const { pool = 'responses', order } = await c.req.json() as {
      pool?: 'responses' | 'faults';
      order: string[];
    };
    const updated = engine.reorderResponses(c.req.param('id'), pool, order);
    if (!updated) return c.body(null, 404);
    return c.json(updated);
  });

  app.post('/stubs/:id/cursor/reset', async (c) => {
    const { pool = 'responses' } = await c.req.json() as {
      pool?: 'responses' | 'faults';
    };
    const updated = engine.resetCursor(c.req.param('id'), pool);
    if (!updated) return c.body(null, 404);
    return c.json(updated);
  });

  app.put('/stubs/:id/cursor', async (c) => {
    const { pool = 'responses', cursor } = await c.req.json() as {
      pool?: 'responses' | 'faults';
      cursor: number;
    };
    const updated = engine.setCursor(c.req.param('id'), pool, cursor);
    if (!updated) return c.body(null, 404);
    return c.json(updated);
  });

  // ---------------------------------------------------------------------------
  // Reset
  // ---------------------------------------------------------------------------

  app.post('/reset', async (c) => {
    await engine.reset();
    return c.json({ message: 'Reset complete' });
  });

  app.post('/save', async (c) => {
    await engine.save();
    return c.json({ message: 'State saved to disk' });
  });

  app.post('/load', async (c) => {
    await engine.load();
    return c.json({ message: 'State loaded from disk' });
  });

  // ---------------------------------------------------------------------------
  // Server settings
  // ---------------------------------------------------------------------------

  app.get('/settings', (c) => {
    return c.json(engine.serverSettings);
  });

  app.patch('/settings', async (c) => {
    const patch = await c.req.json() as Partial<ServerSettings>;
    engine.setServerSettings(patch);
    return c.json(engine.serverSettings);
  });

  // ---------------------------------------------------------------------------
  // SSE — live request feed
  // ---------------------------------------------------------------------------

  app.get('/events', (c) => {
    return stream(c, async (s) => {
      c.header('Content-Type', 'text/event-stream');
      c.header('Cache-Control', 'no-cache');
      c.header('Connection', 'keep-alive');

      const writer: SseWriter = {
        write(data: string) { s.write(data); },
      };

      sseEmitter.addClient(writer);

      const keepalive = setInterval(() => s.write(': ping\n\n'), 15_000);

      s.onAbort(() => {
        clearInterval(keepalive);
        sseEmitter.removeClient(writer);
      });

      await new Promise<void>(() => {});
    });
  });
}
