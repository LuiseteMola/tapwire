import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import type { StubStore } from '../stores';
import type {
  HttpMethod,
  NetworkError,
  ResponseMode,
  Stub,
  StubMode,
  StubResponse,
} from '@tapwire/shared';

export interface CreateStubInput {
  method: HttpMethod;
  host: string;
  pattern: string;
  mode?: StubMode;
}

export interface UpdateStubInput {
  method?: HttpMethod;
  host?: string;
  pattern?: string;
  mode?: StubMode;
  responsesMode?: ResponseMode;
  faultsMode?: ResponseMode;
  responsesActiveResponseId?: string;
  faultsActiveResponseId?: string;
  failureRate?: number;
  delayMs?: number;
  replayDelay?: boolean;
  forcedStatusCode?: number;
  networkError?: NetworkError;
}

export class StubService extends EventEmitter {
  constructor(private readonly stubs: StubStore) {
    super();
  }

  list(): Stub[] {
    return this.stubs.getAll();
  }

  get(id: string): Stub | null {
    return this.stubs.get(id) ?? null;
  }

  create(input: CreateStubInput): Stub {
    const { method, host, pattern, mode = 'mock'} = input;

    const stub = this.stubs.add({
      method,
      host,
      pattern,
      mode,
      config: { failureRate: 0 },
      responses: {
        mode: 'fixed',
        cursor: -1,
        responses: [],
      },
      faults: {
        mode: 'fixed',
        cursor: -1,
        responses: [{
          id: randomUUID(),
          statusCode: 500,
          body: { message: 'Internal Server Error' },
          headers: { 'content-type': 'application/json' },
        }],
      },
    });

    this.emit('stub:created', stub);
    return stub;
  }

  update(id: string, input: UpdateStubInput): Stub | null {
    const stub = this.stubs.get(id);
    if (!stub) {
      return null;
    }

    const { method, host, pattern, mode, responsesMode, faultsMode, responsesActiveResponseId, faultsActiveResponseId, ...configPatch } = input;

    const patch: Partial<Stub> = {
      config: { ...stub.config, ...configPatch },
    };

    if (method !== undefined) patch.method = method;
    if (host !== undefined) patch.host = host;
    if (pattern !== undefined) patch.pattern = pattern;
    if (mode !== undefined) patch.mode = mode;

    if (responsesMode !== undefined || responsesActiveResponseId !== undefined) {
      patch.responses = { ...stub.responses };
      if (responsesMode !== undefined) patch.responses.mode = responsesMode;
      if (responsesActiveResponseId !== undefined) patch.responses.activeResponseId = responsesActiveResponseId;
    }

    if (faultsMode !== undefined || faultsActiveResponseId !== undefined) {
      patch.faults = { ...stub.faults };
      if (faultsMode !== undefined) patch.faults.mode = faultsMode;
      if (faultsActiveResponseId !== undefined) patch.faults.activeResponseId = faultsActiveResponseId;
    }

    this.stubs.update(stub.id, patch);

    const updated = this.stubs.get(stub.id)!;
    this.emit('stub:updated', updated);
    return updated;
  }

  remove(id: string): boolean {
    const stub = this.stubs.get(id);
    if (!stub) {
      return false;
    }
    this.stubs.remove(stub.id);
    this.emit('stub:deleted', { id });
    return true;
  }

  addResponse(stubId: string, pool: 'responses' | 'faults', responseData: Omit<StubResponse, 'id'>): Stub | null {
    const stub = this.stubs.get(stubId);
    if (!stub) {
      return null;
    }

    this.stubs.addResponse(stub.id, pool, responseData);

    const updated = this.stubs.get(stub.id)!;
    this.emit('stub:updated', updated);
    return updated;
  }

  updateResponse(stubId: string, responseId: string, patch: Partial<StubResponse>): Stub | null {
    const stub = this.stubs.get(stubId);
    if (!stub) {
      return null;
    }

    this.stubs.updateResponse(stub.id, responseId, patch);

    const updated = this.stubs.get(stub.id)!;
    if (updated === stub) {
      return null;
    }
    this.emit('stub:updated', updated);
    return updated;
  }

  removeResponse(stubId: string, responseId: string): Stub | null {
    const stub = this.stubs.get(stubId);
    if (!stub) {
      return null;
    }

    this.stubs.removeResponse(stub.id, responseId);

    const updated = this.stubs.get(stub.id)!;
    if (updated === stub) {
      return null;
    }
    this.emit('stub:updated', updated);
    return updated;
  }

  reorderResponses(stubId: string, pool: 'responses' | 'faults', orderedIds: string[]): Stub | null {
    const stub = this.stubs.get(stubId);
    if (!stub) {
      return null;
    }

    this.stubs.reorderResponses(stub.id, pool, orderedIds);

    const updated = this.stubs.get(stub.id)!;
    if (updated === stub) {
      return null;
    }
    this.emit('stub:updated', updated);
    return updated;
  }

  resetCursor(stubId: string, pool: 'responses' | 'faults'): Stub | null {
    const stub = this.stubs.get(stubId);
    if (!stub) {
      return null;
    }

    this.stubs.update(stub.id, {
      [pool]: { ...stub[pool], cursor: -1 },
    });

    const updated = this.stubs.get(stub.id)!;
    this.emit('stub:cursor-changed', { id: stub.id, pool, cursor: -1 });
    return updated;
  }

  setCursor(stubId: string, pool: 'responses' | 'faults', cursor: number): Stub | null {
    const stub = this.stubs.get(stubId);
    if (!stub) {
      return null;
    }

    const responses = stub[pool].responses;
    if (cursor < -1 || cursor >= responses.length) {
      return null;
    }

    this.stubs.update(stub.id, {
      [pool]: { ...stub[pool], cursor },
    });

    const updated = this.stubs.get(stub.id)!;
    this.emit('stub:cursor-changed', { id: stub.id, pool, cursor });
    return updated;
  }

  reset(): void {
    this.stubs.clear();
  }
}
