import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { FsStateStore } from './fs-state-store';
import type { StateStore } from './state-store';
import type { Stub } from '@tapwire/shared';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let idCounter = 0;

function makeStub(overrides: Partial<Stub> = {}): Stub {
  const id = `stub-${++idCounter}`;
  return {
    id,
    method: 'GET',
    host: 'api.example.com',
    pattern: '/users/:id',
    mode: 'mock',
    config: { failureRate: 0 },
    responses: {
      mode: 'sequential',
      cursor: 2, // intentionally non-clean to test cursor reset on flush/load
      responses: [
        {
          id: `resp-${id}-1`,
          statusCode: 200,
          body: { id: 1, name: 'Jane' },
          headers: { 'content-type': 'application/json' },
          capturedAt: '2025-01-15T14:32:00Z',
        },
      ],
    },
    faults: {
      mode: 'fixed',
      cursor: 1,
      responses: [
        {
          id: `resp-${id}-2`,
          statusCode: 404,
          body: { message: 'Not found' },
          headers: {},
        },
      ],
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('FsStateStore', () => {
  let tmpDir: string;
  let store: StateStore;

  beforeEach(() => {
    idCounter = 0;
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tapwire-test-'));
    store = new FsStateStore(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // -------------------------------------------------------------------------
  // load()
  // -------------------------------------------------------------------------

  it('load() on a missing directory returns empty snapshot and creates the directory', async () => {
    const missingDir = path.join(tmpDir, 'nested', 'fixtures');
    const freshStore = new FsStateStore(missingDir);

    const snapshot = await freshStore.load();

    expect(snapshot.stubs).toEqual([]);
    expect(fs.existsSync(missingDir)).toBe(true);
  });

  it('load() on an empty directory returns empty snapshot', async () => {
    const snapshot = await store.load();
    expect(snapshot.stubs).toEqual([]);
  });

  it('load() resets cursors to -1 regardless of stored value', async () => {
    const stub = makeStub();
    const filePath = path.join(tmpDir, `${stub.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify({ ...stub, responses: { ...stub.responses, cursor: 99 } }, null, 2));

    const snapshot = await store.load();
    expect(snapshot.stubs[0].responses.cursor).toBe(-1);
  });

  it('load() skips corrupted JSON files', async () => {
    fs.writeFileSync(path.join(tmpDir, 'bad.json'), '{ not valid json', 'utf-8');

    const snapshot = await store.load();
    expect(snapshot.stubs).toEqual([]);
  });

  it('load() skips files with invalid shape', async () => {
    fs.writeFileSync(path.join(tmpDir, 'wrong.json'), JSON.stringify({ id: 'x', method: 'GET' }), 'utf-8');

    const snapshot = await store.load();
    expect(snapshot.stubs).toEqual([]);
  });

  // -------------------------------------------------------------------------
  // flush()
  // -------------------------------------------------------------------------

  it('flush() writes all stubs as JSON files', async () => {
    const a = makeStub();
    const b = makeStub();

    await store.flush({ stubs: [a, b] });

    expect(fs.existsSync(path.join(tmpDir, `${a.id}.json`))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, `${b.id}.json`))).toBe(true);
  });

  it('flush() resets cursors to -1 in written files', async () => {
    const stub = makeStub(); // cursors are 2 and 1

    await store.flush({ stubs: [stub] });

    const raw = fs.readFileSync(path.join(tmpDir, `${stub.id}.json`), 'utf-8');
    const parsed = JSON.parse(raw);
    expect(parsed.responses.cursor).toBe(-1);
    expect(parsed.faults.cursor).toBe(-1);
  });

  it('flush() does not mutate the in-memory stubs', async () => {
    const stub = makeStub();

    await store.flush({ stubs: [stub] });

    expect(stub.responses.cursor).toBe(2);
    expect(stub.faults.cursor).toBe(1);
  });

  it('flush() deletes orphaned files not in the snapshot', async () => {
    const a = makeStub();
    const b = makeStub();

    // Write both initially
    await store.flush({ stubs: [a, b] });
    expect(fs.existsSync(path.join(tmpDir, `${a.id}.json`))).toBe(true);

    // Flush with only b — a should be deleted
    await store.flush({ stubs: [b] });
    expect(fs.existsSync(path.join(tmpDir, `${a.id}.json`))).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, `${b.id}.json`))).toBe(true);
  });

  it('flush() with empty snapshot deletes all files', async () => {
    const a = makeStub();
    await store.flush({ stubs: [a] });

    await store.flush({ stubs: [] });

    const files = fs.readdirSync(tmpDir).filter(f => f.endsWith('.json'));
    expect(files).toHaveLength(0);
  });

  it('flush() creates directory if it does not exist', async () => {
    const missingDir = path.join(tmpDir, 'new', 'fixtures');
    const freshStore = new FsStateStore(missingDir);
    const stub = makeStub();

    await freshStore.flush({ stubs: [stub] });

    expect(fs.existsSync(path.join(missingDir, `${stub.id}.json`))).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Round-trip
  // -------------------------------------------------------------------------

  it('flush() then load() round-trips stubs without data loss', async () => {
    const stub = makeStub();

    await store.flush({ stubs: [stub] });
    const snapshot = await store.load();

    expect(snapshot.stubs).toHaveLength(1);
    expect(snapshot.stubs[0].id).toBe(stub.id);
    expect(snapshot.stubs[0].method).toBe(stub.method);
    expect(snapshot.stubs[0].pattern).toBe(stub.pattern);
    expect(snapshot.stubs[0].responses.responses).toHaveLength(1);
  });

  it('flush() overwrites existing files on re-flush', async () => {
    const stub = makeStub();
    await store.flush({ stubs: [stub] });

    const updated = { ...stub, mode: 'proxy' as const };
    await store.flush({ stubs: [updated] });

    const snapshot = await store.load();
    expect(snapshot.stubs).toHaveLength(1);
    expect(snapshot.stubs[0].mode).toBe('proxy');
  });
});
