import { randomUUID } from 'node:crypto';
import { match as compilePath } from 'path-to-regexp';
import type { HttpMethod, Stub, StubResponse } from '@tapwire/shared';

/** A stub without an id — the store generates it. */
export type NewStub = Omit<Stub, 'id'> & { id?: string };

// ---------------------------------------------------------------------------
// Internal
// ---------------------------------------------------------------------------

interface CompiledStub {
  stub: Stub;
  /** Compiled pattern matcher — called on every incoming pathname. */
  matchFn: ReturnType<typeof compilePath>;
  /** Pre-computed score used to sort stubs. Higher = checked first. */
  specificity: number;
}

/**
 * Computes a specificity score for an Express-style route pattern.
 *
 * Scoring:
 *   Literal segment  → 10 pts  (/users, /me, /posts)
 *   Parameter        →  1 pt   (:id, :org)
 *   Wildcard         →  0 pts  (*)
 *
 * Examples:
 *   /users/me        → 20   beats /users/:id for GET /users/me
 *   /users/:id       → 11
 *   /users/:id/posts → 21   beats /users/:id for deeper paths
 */
function computeSpecificity(pattern: string): number {
  return pattern
    .split('/')
    .filter(Boolean)
    .reduce((score, segment) => {
      if (segment === '*') { return score };
      if (segment.startsWith(':')) { return score + 1 };
      return score + 10;
    }, 0);
}

// ---------------------------------------------------------------------------
// StubStore
// ---------------------------------------------------------------------------

export class StubStore {
  /** Stubs sorted highest-specificity first. */
  private entries: CompiledStub[] = [];

  // -------------------------------------------------------------------------
  // Mutations
  // -------------------------------------------------------------------------

  /** Registers a stub. If a stub with the same method/host/pattern exists, merges responses into it. Returns the stub in the store. */
  add(input: NewStub): Stub {
    const existing = this.findByMethodHostAndPattern(input.method, input.host, input.pattern);
    if (existing) {
      input.responses.responses.forEach(r => this.addResponse(existing.id, 'responses', r));
      return this.get(existing.id)!;
    }

    const stub: Stub = { ...input, id: input.id ?? randomUUID() };

    const entry: CompiledStub = {
      stub,
      matchFn: compilePath(stub.pattern, { decode: decodeURIComponent }),
      specificity: computeSpecificity(stub.pattern),
    };

    const insertAt = this.entries.findIndex(c => c.specificity < entry.specificity);
    if (insertAt === -1) {
      this.entries.push(entry);
    } else {
      this.entries.splice(insertAt, 0, entry);
    }

    return stub;
  }

  /** Removes a stub by id. No-op if not found. */
  remove(id: string): void {
    this.entries = this.entries.filter(c => c.stub.id !== id);
  }

  /** Removes all stubs. */
  clear(): void {
    this.entries = [];
  }

  /**
   * Applies a partial update to a stub.
   * Re-compiles and re-sorts if the pattern changed.
   */
  update(id: string, patch: Partial<Stub>): void {
    const index = this.entries.findIndex(c => c.stub.id === id);
    if (index === -1) {
      return;
    }

    const updated: Stub = { ...this.entries[index].stub, ...patch };
    this.entries.splice(index, 1);
    this.add(updated);
  }

  /** Appends a response to a stub's pool. Generates an ID if not provided. */
  addResponse(id: string, pool: 'responses' | 'faults', response: Omit<StubResponse, 'id'> & { id?: string }): void {
    const stub = this.get(id);
    if (!stub) {
      return;
    }

    const responseWithId: StubResponse = { ...response, id: response.id ?? randomUUID() };

    this.update(id, {
      [pool]: {
        ...stub[pool],
        responses: [...stub[pool].responses, responseWithId],
      },
    });
  }

  /** Returns an existing response from the stub's pools. */
  findResponse(stub: Stub, responseId: string): { pool: 'responses' | 'faults'; response: StubResponse } | null {
    const inResponses = stub.responses.responses.find(r => r.id === responseId);
    if (inResponses) {
      return { pool: 'responses', response: inResponses };
    }

    const inFaults = stub.faults.responses.find(r => r.id === responseId);
    if (inFaults) {
      return { pool: 'faults', response: inFaults };
    }

    return null;
  }

  /** Removes a response from a stub's pool. Checks both pools if pool is not specified. */
  removeResponse(id: string, responseId: string): void {
    const stub = this.get(id);
    if (!stub) {
      return;
    }

    const { pool, response } = this.findResponse(stub, responseId) ?? {};
    if (!pool || !response) {
      return;
    }

    this.update(id, {
      [pool]: {
        ...stub[pool],
        responses: stub[pool].responses.filter(r => r.id !== responseId),
      },
    });
  }

  /** Reorders responses in a stub's pool to match the given ID order. */
  reorderResponses(id: string, pool: 'responses' | 'faults', orderedIds: string[]): void {
    const stub = this.get(id);
    if (!stub) {
      return;
    }

    const current = stub[pool].responses;
    const byId = new Map(current.map(r => [r.id, r]));

    // Validate: same set of IDs
    if (orderedIds.length !== current.length || !orderedIds.every(rid => byId.has(rid))) {
      return;
    }

    this.update(id, {
      [pool]: {
        ...stub[pool],
        responses: orderedIds.map(rid => byId.get(rid)!),
      },
    });
  }

  /** Updates a response in a stub's pool. Searches both pools. */
  updateResponse(id: string, responseId: string, patch: Partial<StubResponse>): void {
    const stub = this.get(id);
    if (!stub) {
      return;
    }

    const { pool } = this.findResponse(stub, responseId) ?? {};
    if (!pool) {
      return;
    }

    this.update(id, {
      [pool]: {
        ...stub[pool],
        responses: stub[pool].responses.map(r =>
          r.id === responseId ? { ...r, ...patch, id: r.id } : r,
        ),
      },
    });
  }

  // -------------------------------------------------------------------------
  // Queries
  // -------------------------------------------------------------------------

  get(id: string): Stub | undefined {
    return this.entries.find(c => c.stub.id === id)?.stub;
  }

  /** Returns all stubs in specificity order (highest first). */
  getAll(): Stub[] {
    return this.entries.map(c => c.stub);
  }

  /** Finds an existing stub by exact method + host + pattern match. */
  findByMethodHostAndPattern(method: HttpMethod, host: string, pattern: string): Stub | undefined {
    return this.entries.find(c => c.stub.method === method && c.stub.host === host && c.stub.pattern === pattern)?.stub;
  }

  /**
   * Returns the highest-specificity stub that matches the given method, host,
   * and pathname, or null if none match.
   */
  match(method: HttpMethod, host: string, pathname: string): Stub | null {
    for (const entry of this.entries) {
      if (entry.stub.method !== method) continue;
      if (entry.stub.host !== host) continue;
      if (entry.matchFn(pathname)) {
        return entry.stub;
      }
    }
    return null;
  }
}
