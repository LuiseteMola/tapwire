import { describe, it, expect, beforeEach } from 'vitest';
import { StubStore } from './stub-store';
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

// ---------------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------------

describe('StubStore — matching', () => {
  let store: StubStore;

  beforeEach(() => {
    idCounter = 0;
    store = new StubStore();
  });

  it('matches a parameterised pattern against a concrete path', () => {
    store.add(makeStub('GET', '/users/:id'));
    expect(store.match('GET', 'api.example.com', '/users/123')).not.toBeNull();
  });

  it('exact literal path beats parameterised path', () => {
    const paramStub = makeStub('GET', '/users/:id');
    const exactStub = makeStub('GET', '/users/me');
    store.add(paramStub);
    store.add(exactStub);

    const result = store.match('GET', 'api.example.com', '/users/me');
    expect(result?.id).toBe(exactStub.id);
  });

  it('method mismatch returns null', () => {
    store.add(makeStub('GET', '/users/:id'));
    expect(store.match('POST', 'api.example.com', '/users/123')).toBeNull();
  });

  it('same path on different hosts matches the correct stub', () => {
    const stripeStub = makeStub('GET', '/users/:id', { host: 'api.stripe.com' });
    const githubStub = makeStub('GET', '/users/:id', { host: 'api.github.com' });
    store.add(stripeStub);
    store.add(githubStub);

    expect(store.match('GET', 'api.stripe.com', '/users/1')?.id).toBe(stripeStub.id);
    expect(store.match('GET', 'api.github.com', '/users/1')?.id).toBe(githubStub.id);
    expect(store.match('GET', 'api.unknown.com', '/users/1')).toBeNull();
  });

  it('host mismatch returns null', () => {
    store.add(makeStub('GET', '/users/:id', { host: 'api.stripe.com' }));
    expect(store.match('GET', 'api.github.com', '/users/123')).toBeNull();
  });

  it('unknown path returns null', () => {
    store.add(makeStub('GET', '/users/:id'));
    expect(store.match('GET', 'api.example.com', '/products/99')).toBeNull();
  });

  it('longer parameterised path beats shorter parameterised path', () => {
    const shallow = makeStub('GET', '/users/:id');
    const deep = makeStub('GET', '/users/:id/posts');
    store.add(shallow);
    store.add(deep);

    expect(store.match('GET', 'api.example.com', '/users/123/posts')?.id).toBe(deep.id);
    expect(store.match('GET', 'api.example.com', '/users/123')?.id).toBe(shallow.id);
  });

  it('returns highest-specificity match when multiple stubs are registered', () => {
    const a = makeStub('GET', '/:resource');  // matches single-segment paths: /orders
    const b = makeStub('GET', '/users/:id');
    const c = makeStub('GET', '/users/me');
    store.add(a);
    store.add(b);
    store.add(c);

    expect(store.match('GET', 'api.example.com', '/users/me')?.id).toBe(c.id);
    expect(store.match('GET', 'api.example.com', '/users/42')?.id).toBe(b.id);
    expect(store.match('GET', 'api.example.com', '/orders')?.id).toBe(a.id);   // single segment — /:resource matches
    expect(store.match('GET', 'api.example.com', '/orders/7')).toBeNull();      // two segments — no stub covers this
  });
});

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

describe('StubStore — mutations', () => {
  let store: StubStore;

  beforeEach(() => {
    idCounter = 0;
    store = new StubStore();
  });

  it('add() merges responses into existing stub with same method/host/pattern', () => {
    const first = makeStub('GET', '/users/:id');
    const duplicate = makeStub('GET', '/users/:id');

    store.add(first);
    store.add(duplicate);

    expect(store.getAll()).toHaveLength(1);
    const stub = store.getAll()[0];
    expect(stub.id).toBe(first.id);
    expect(stub.responses.responses).toHaveLength(2);
    expect(stub.responses.responses[1].id).toBe(duplicate.responses.responses[0].id);
  });

  it('add() inserts stubs in specificity order', () => {
    const low = makeStub('GET', '/:any');
    const mid = makeStub('GET', '/users/:id');
    const high = makeStub('GET', '/users/me');

    store.add(mid);
    store.add(low);
    store.add(high);

    const ids = store.getAll().map(s => s.id);
    expect(ids).toEqual([high.id, mid.id, low.id]);
  });

  it('remove() removes a stub by id', () => {
    const stub = makeStub('GET', '/users/:id');
    store.add(stub);
    store.remove(stub.id);
    expect(store.get(stub.id)).toBeUndefined();
    expect(store.match('GET', 'api.example.com', '/users/1')).toBeNull();
  });

  it('update() with a new pattern re-sorts correctly', () => {
    const a = makeStub('GET', '/:any');     // specificity 1
    const b = makeStub('GET', '/users/me'); // specificity 20
    store.add(a);
    store.add(b);

    // Promote a to an exact match — should now beat b
    store.update(a.id, { pattern: '/users/me/settings' }); // specificity 30

    const all = store.getAll();
    expect(all[0].id).toBe(a.id);
  });

  it('get() returns the stub or undefined', () => {
    const stub = makeStub('GET', '/health');
    store.add(stub);
    expect(store.get(stub.id)?.id).toBe(stub.id);
    expect(store.get('nonexistent')).toBeUndefined();
  });
});
