import { describe, it, expect, beforeEach } from 'vitest';
import { CaptureStore } from './capture-store';
import type { CapturedRequest } from '@tapwire/shared';

let idCounter = 0;

function makeCapture(overrides: Partial<CapturedRequest> = {}): CapturedRequest {
  const id = `cap-${++idCounter}`;
  return {
    id,
    served: 'served' as const,
    resolutionType: 'passthrough' as const,
    method: 'GET',
    url: 'https://api.example.com/users/1',
    host: 'api.example.com',
    pathname: '/users/1',
    requestHeaders: {},
    requestBody: null,
    responseStatus: 200,
    responseHeaders: { 'content-type': 'application/json' },
    responseBody: { id: 1 },
    latencyMs: 42,
    capturedAt: new Date().toISOString(),
    promoted: false,
    ...overrides,
  };
}

describe('CaptureStore', () => {
  let inbox: CaptureStore;

  beforeEach(() => {
    idCounter = 0;
    inbox = new CaptureStore();
  });

  it('add() and getAll() returns captures in chronological order (oldest first)', () => {
    const a = makeCapture();
    const b = makeCapture();
    const c = makeCapture();
    inbox.add(a);
    inbox.add(b);
    inbox.add(c);

    const ids = inbox.getAll().map(e => e.id);
    expect(ids).toEqual([a.id, b.id, c.id]);
  });

  it('get() returns a capture by id', () => {
    const cap = makeCapture();
    inbox.add(cap);
    expect(inbox.get(cap.id)?.id).toBe(cap.id);
  });

  it('get() returns undefined for unknown id', () => {
    expect(inbox.get('nonexistent')).toBeUndefined();
  });

  it('remove() removes a capture by id', () => {
    const cap = makeCapture();
    inbox.add(cap);
    inbox.remove(cap.id);
    expect(inbox.get(cap.id)).toBeUndefined();
    expect(inbox.size).toBe(0);
  });

  it('clear() empties the inbox', () => {
    inbox.add(makeCapture());
    inbox.add(makeCapture());
    inbox.clear();
    expect(inbox.size).toBe(0);
    expect(inbox.getAll()).toEqual([]);
  });

  it('exceeding maxSize drops the oldest entry', () => {
    const small = new CaptureStore(3);
    const a = makeCapture();
    const b = makeCapture();
    const c = makeCapture();
    const d = makeCapture();

    small.add(a);
    small.add(b);
    small.add(c);
    small.add(d); // a should be dropped

    expect(small.size).toBe(3);
    expect(small.get(a.id)).toBeUndefined();
    expect(small.getAll().map(e => e.id)).toEqual([b.id, c.id, d.id]);
  });

  it('respects a custom maxSize passed to the constructor', () => {
    const inbox10 = new CaptureStore(10);
    for (let i = 0; i < 15; i++) inbox10.add(makeCapture());
    expect(inbox10.size).toBe(10);
  });
});
