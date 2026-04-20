import fs from 'node:fs/promises';
import path from 'node:path';
import type { Stub } from '@tapwire/shared';
import type { StateStore, StateSnapshot } from './state-store';

// ---------------------------------------------------------------------------
// Shape validation
// ---------------------------------------------------------------------------

/**
 * Minimal structural check before trusting a parsed fixture file.
 * Not exhaustive — guards against missing required fields that would cause
 * silent runtime failures in StubStore (e.g. missing responses.responses).
 */
function isValidStub(value: unknown): value is Stub {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const s = value as Record<string, unknown>;

  if (typeof s['id'] !== 'string') {
    return false;
  }
  if (typeof s['method'] !== 'string') {
    return false;
  }
  if (typeof s['host'] !== 'string') {
    return false;
  }
  if (typeof s['pattern'] !== 'string') {
    return false;
  }
  if (typeof s['mode'] !== 'string') {
    return false;
  }
  if (typeof s['config'] !== 'object' || s['config'] === null) {
    return false;
  }

  for (const pool of ['responses', 'faults'] as const) {
    const p = s[pool];
    if (typeof p !== 'object' || p === null) {
      return false;
    }
    const poolObj = p as Record<string, unknown>;
    if (!Array.isArray(poolObj['responses'])) {
      return false;
    }
  }

  return true;
}

// ---------------------------------------------------------------------------
// FsStateStore
// ---------------------------------------------------------------------------

export class FsStateStore implements StateStore {
  constructor(private readonly fixturesDir: string) {}

  /**
   * Reads all *.json files in fixturesDir and returns valid stubs.
   * Creates the directory if it does not exist.
   * Skips files that fail to parse or fail the shape check, with a warning.
   * Resets all response pool cursors to -1 (never start mid-sequence).
   */
  async load(): Promise<StateSnapshot> {
    await fs.mkdir(this.fixturesDir, { recursive: true });

    const files = (await fs.readdir(this.fixturesDir)).filter(f => f.endsWith('.json'));
    const stubs: Stub[] = [];

    for (const file of files) {
      const filePath = path.join(this.fixturesDir, file);
      try {
        const raw = await fs.readFile(filePath, 'utf-8');
        const parsed: unknown = JSON.parse(raw);

        if (!isValidStub(parsed)) {
          console.warn(`[tapwire] Skipping invalid fixture: ${file}`);
          continue;
        }

        // Always reset cursors — never start a session mid-sequence
        parsed.responses.cursor = -1;
        parsed.faults.cursor = -1;

        stubs.push(parsed);
      } catch {
        console.warn(`[tapwire] Failed to load fixture ${file} — skipping`);
      }
    }

    return { stubs };
  }

  /**
   * Persists the full engine state to disk.
   * Reconciles with the existing directory: writes all current stubs,
   * deletes orphaned files that no longer correspond to a stub.
   * Resets cursors to -1 before writing so committed files are always clean.
   */
  async flush(snapshot: StateSnapshot): Promise<void> {
    await fs.mkdir(this.fixturesDir, { recursive: true });

    // Determine which files currently exist on disk
    const existingFiles = (await fs.readdir(this.fixturesDir)).filter(f => f.endsWith('.json'));
    const existingIds = new Set(existingFiles.map(f => f.replace('.json', '')));

    // Determine which IDs are in the current state
    const currentIds = new Set(snapshot.stubs.map(s => s.id));

    // Delete orphaned files
    for (const id of existingIds) {
      if (!currentIds.has(id)) {
        try {
          await fs.unlink(path.join(this.fixturesDir, `${id}.json`));
        } catch (err: unknown) {
          if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
            throw err;
          }
        }
      }
    }

    // Write all current stubs
    for (const stub of snapshot.stubs) {
      const clean: Stub = {
        ...stub,
        responses: { ...stub.responses, cursor: -1 },
        faults: { ...stub.faults, cursor: -1 },
      };

      const filePath = path.join(this.fixturesDir, `${stub.id}.json`);
      await fs.writeFile(filePath, JSON.stringify(clean, null, 2), 'utf-8');
    }
  }
}
