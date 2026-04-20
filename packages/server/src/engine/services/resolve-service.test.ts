import { describe, it, expect, beforeEach } from 'vitest';
import { StubStore } from '../stores';
import { ResolveService } from './resolve-service';
import type { Stub, StubResponse } from '@tapwire/shared';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let idCounter = 0;

function makeResponse(statusCode = 200): StubResponse {
  return {
    id: `resp-${++idCounter}`,
    statusCode,
    body: { ok: true },
    headers: { 'content-type': 'application/json' },
  };
}

function makeStub(
  method: Stub['method'],
  pattern: string,
  overrides: Partial<Stub> = {},
): Stub {
  return {
    id: `stub-${++idCounter}`,
    method,
    host: 'api.example.com',
    pattern,
    mode: 'mock',
    config: { failureRate: 0 },
    responses: { mode: 'fixed', cursor: -1, responses: [makeResponse(200)] },
    faults: { mode: 'fixed', cursor: -1, responses: [makeResponse(500)] },
    ...overrides,
  };
}

function createService(rand?: () => number) {
  const stubs = new StubStore();
  const service = new ResolveService(stubs, rand);
  return { stubs, service };
}

// ---------------------------------------------------------------------------
// Resolution
// ---------------------------------------------------------------------------

describe('ResolveService — resolution', () => {
  let stubs: StubStore;
  let service: ResolveService;

  beforeEach(() => {
    idCounter = 0;
    ({ stubs, service } = createService());
  });

  it('returns passthrough when no stub matches', () => {
    const result = service.resolve('GET', 'api.example.com', '/unknown');
    expect(result.type).toBe('passthrough');
  });

  it('returns proxy when stub is in proxy mode', () => {
    stubs.add(makeStub('GET', '/users/:id', { mode: 'proxy' }));
    const result = service.resolve('GET', 'api.example.com', '/users/1');
    expect(result.type).toBe('proxy');
  });

  it('returns record when stub is in record mode', () => {
    stubs.add(makeStub('GET', '/users/:id', { mode: 'record' }));
    const result = service.resolve('GET', 'api.example.com', '/users/1');
    expect(result.type).toBe('record');
  });

  it('returns mock when stub is in mock mode', () => {
    stubs.add(makeStub('GET', '/users/:id'));
    const result = service.resolve('GET', 'api.example.com', '/users/1');
    expect(result.type).toBe('mock');
  });

  it('failureRate 0 always returns responses pool', () => {
    const stub = makeStub('GET', '/users/:id', {
      config: { failureRate: 0 },
    });
    stubs.add(stub);

    for (let i = 0; i < 20; i++) {
      const result = service.resolve('GET', 'api.example.com', '/users/1');
      expect(result.type).toBe('mock');
      if (result.type === 'mock') {
        expect(result.response.statusCode).toBe(200);
      }
    }
  });

  it('failureRate 100 always returns faults pool', () => {
    const stub = makeStub('GET', '/users/:id', {
      config: { failureRate: 100 },
    });
    stubs.add(stub);

    for (let i = 0; i < 20; i++) {
      const result = service.resolve('GET', 'api.example.com', '/users/1');
      expect(result.type).toBe('mock');
      if (result.type === 'mock') {
        expect(result.response.statusCode).toBe(500);
      }
    }
  });

  it('deterministic rand controls failure injection', () => {
    // rand always returns 0.4 → 0.4 * 100 = 40 → 40 < 50 → failureRate 50 triggers failure
    const { stubs: s1, service: svc1 } = createService(() => 0.4);
    s1.add(makeStub('GET', '/users/:id', { config: { failureRate: 50 } }));
    const result = svc1.resolve('GET', 'api.example.com', '/users/1');
    expect(result.type).toBe('mock');
    if (result.type === 'mock') expect(result.response.statusCode).toBe(500);

    // rand always returns 0.6 → 0.6 * 100 = 60 → 60 < 50 is false → failureRate 50 does NOT trigger
    const { stubs: s2, service: svc2 } = createService(() => 0.6);
    s2.add(makeStub('GET', '/users/:id', { config: { failureRate: 50 } }));
    const result2 = svc2.resolve('GET', 'api.example.com', '/users/1');
    expect(result2.type).toBe('mock');
    if (result2.type === 'mock') expect(result2.response.statusCode).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// Response selection
// ---------------------------------------------------------------------------

describe('ResolveService — response selection', () => {
  let stubs: StubStore;
  let service: ResolveService;

  beforeEach(() => {
    idCounter = 0;
    ({ stubs, service } = createService());
  });

  it('fixed mode always returns the same response', () => {
    const r1 = makeResponse(200);
    const r2 = makeResponse(201);
    const stub = makeStub('GET', '/items', {
      responses: { mode: 'fixed', cursor: -1, responses: [r1, r2] },
    });
    stubs.add(stub);

    const ids = Array.from({ length: 5 }, () => {
      const res = service.resolve('GET', 'api.example.com', '/items');
      return res.type === 'mock' ? res.response.id : null;
    });
    expect(new Set(ids).size).toBe(1);
    expect(ids[0]).toBe(r1.id);
  });

  it('sequential mode cycles through responses in order', () => {
    const r1 = makeResponse(200);
    const r2 = makeResponse(201);
    const r3 = makeResponse(202);
    const stub = makeStub('GET', '/items', {
      responses: { mode: 'sequential', cursor: -1, responses: [r1, r2, r3] },
    });
    stubs.add(stub);

    const results = Array.from({ length: 3 }, () => {
      const res = service.resolve('GET', 'api.example.com', '/items');
      return res.type === 'mock' ? res.response.id : null;
    });
    expect(results).toEqual([r1.id, r2.id, r3.id]);
  });

  it('sequential mode wraps around at the end', () => {
    const r1 = makeResponse(200);
    const r2 = makeResponse(201);
    const stub = makeStub('GET', '/items', {
      responses: { mode: 'sequential', cursor: -1, responses: [r1, r2] },
    });
    stubs.add(stub);

    const results = Array.from({ length: 4 }, () => {
      const res = service.resolve('GET', 'api.example.com', '/items');
      return res.type === 'mock' ? res.response.id : null;
    });
    expect(results).toEqual([r1.id, r2.id, r1.id, r2.id]);
  });

  it('random mode returns a response from the pool', () => {
    const r1 = makeResponse(200);
    const r2 = makeResponse(201);
    const stub = makeStub('GET', '/items', {
      responses: { mode: 'random', cursor: -1, responses: [r1, r2] },
    });
    stubs.add(stub);

    const res = service.resolve('GET', 'api.example.com', '/items');
    expect(res.type).toBe('mock');
    if (res.type === 'mock') {
      expect([r1.id, r2.id]).toContain(res.response.id);
    }
  });

  it('forcedStatusCode overrides the response status code', () => {
    const stub = makeStub('GET', '/items', {
      config: { failureRate: 0, forcedStatusCode: 503 },
    });
    stubs.add(stub);

    const res = service.resolve('GET', 'api.example.com', '/items');
    expect(res.type).toBe('mock');
    if (res.type === 'mock') expect(res.response.statusCode).toBe(503);
  });
});

// ---------------------------------------------------------------------------
// Network error resolution
// ---------------------------------------------------------------------------

describe('ResolveService — network error', () => {
  let stubs: StubStore;
  let service: ResolveService;

  beforeEach(() => {
    idCounter = 0;
    ({ stubs, service } = createService());
  });

  it('returns network-error when networkError is set', () => {
    const stub = makeStub('GET', '/users/:id', {
      config: { failureRate: 0, networkError: 'connection-reset' },
    });
    stubs.add(stub);

    const res = service.resolve('GET', 'api.example.com', '/users/1');
    expect(res.type).toBe('network-error');
    if (res.type === 'network-error') {
      expect(res.errorCode).toBe('ECONNRESET');
      expect(res.errorMessage).toBe('socket hang up');
    }
  });

  it('returns network-error for timeout', () => {
    const stub = makeStub('GET', '/slow', {
      config: { failureRate: 0, networkError: 'timeout' },
    });
    stubs.add(stub);

    const res = service.resolve('GET', 'api.example.com', '/slow');
    expect(res.type).toBe('network-error');
    if (res.type === 'network-error') {
      expect(res.errorCode).toBe('ETIMEDOUT');
    }
  });

  it('returns network-error for connection-refused', () => {
    const stub = makeStub('GET', '/down', {
      config: { failureRate: 0, networkError: 'connection-refused' },
    });
    stubs.add(stub);

    const res = service.resolve('GET', 'api.example.com', '/down');
    expect(res.type).toBe('network-error');
    if (res.type === 'network-error') {
      expect(res.errorCode).toBe('ECONNREFUSED');
    }
  });

  it('returns network-error for dns-not-found', () => {
    const stub = makeStub('GET', '/dns', {
      config: { failureRate: 0, networkError: 'dns-not-found' },
    });
    stubs.add(stub);

    const res = service.resolve('GET', 'api.example.com', '/dns');
    expect(res.type).toBe('network-error');
    if (res.type === 'network-error') {
      expect(res.errorCode).toBe('ENOTFOUND');
    }
  });

  it('returns network-error for connection-aborted', () => {
    const stub = makeStub('GET', '/abort', {
      config: { failureRate: 0, networkError: 'connection-aborted' },
    });
    stubs.add(stub);

    const res = service.resolve('GET', 'api.example.com', '/abort');
    expect(res.type).toBe('network-error');
    if (res.type === 'network-error') {
      expect(res.errorCode).toBe('ECONNABORTED');
    }
  });

  it('networkError "none" falls through to normal mock resolution', () => {
    const stub = makeStub('GET', '/users/:id', {
      config: { failureRate: 0, networkError: 'none' },
    });
    stubs.add(stub);

    const res = service.resolve('GET', 'api.example.com', '/users/1');
    expect(res.type).toBe('mock');
  });

  it('networkError takes priority over failureRate', () => {
    const stub = makeStub('GET', '/users/:id', {
      config: { failureRate: 100, networkError: 'timeout' },
    });
    stubs.add(stub);

    const res = service.resolve('GET', 'api.example.com', '/users/1');
    expect(res.type).toBe('network-error');
  });

  it('networkError is ignored in proxy mode', () => {
    const stub = makeStub('GET', '/users/:id', {
      mode: 'proxy',
      config: { failureRate: 0, networkError: 'connection-reset' },
    });
    stubs.add(stub);

    const res = service.resolve('GET', 'api.example.com', '/users/1');
    expect(res.type).toBe('proxy');
  });
});
