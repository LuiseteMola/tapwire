import { create } from 'zustand';
import type { Stub, StubMode, ResponseMode, StubResponse, NetworkError, ServerMode, ServerSettings } from '../types';
import { subscribeSse } from './sse-connection';

interface StubPatch {
  method?: string;
  host?: string;
  pattern?: string;
  mode?: StubMode;
  responsesMode?: ResponseMode;
  faultsMode?: ResponseMode;
  failureRate?: number;
  delayMs?: number | null;
  replayDelay?: boolean;
  networkError?: NetworkError;
  responsesActiveResponseId?: string;
  faultsActiveResponseId?: string;
}

async function jsonOk<T>(res: Response): Promise<T> {
  if (!res.ok) {
    throw new Error(`Request failed: ${res.status}`);
  }
  return await res.json() as T;
}

interface StubState {
  stubs: Stub[];
  loading: boolean;
  dirty: boolean;
  serverMode: ServerMode;
  strict: boolean;
  autoSave: boolean;

  // Actions
  initSSE: () => void;
  refresh: () => Promise<void>;
  refreshSettings: () => Promise<void>;
  setServerSettings: (patch: Partial<ServerSettings>) => Promise<void>;
  update: (id: string, patch: StubPatch) => Promise<void>;
  updateResponse: (stubId: string, responseId: string, patch: Partial<StubResponse>) => Promise<void>;
  createStub: (data: { method: string; host: string; pattern: string; mode?: string; statusCode?: number; body?: unknown; headers?: Record<string, string> }) => Promise<Stub>;
  addResponse: (stubId: string, pool: 'responses' | 'faults', data: Omit<StubResponse, 'id'>) => Promise<void>;
  deleteStub: (id: string) => Promise<void>;
  deleteResponse: (stubId: string, responseId: string) => Promise<void>;
  reorderResponses: (stubId: string, pool: 'responses' | 'faults', orderedIds: string[]) => Promise<void>;
  resetCursor: (stubId: string, pool: 'responses' | 'faults') => Promise<void>;
  setCursor: (stubId: string, pool: 'responses' | 'faults', cursor: number) => Promise<void>;
  save: () => Promise<void>;
  reset: () => Promise<void>;
}

export const useStubStore = create<StubState>((set) => ({
  stubs: [],
  loading: false,
  dirty: false,
  serverMode: 'default',
  strict: false,
  autoSave: false,

  initSSE: () => {
    subscribeSse('stub:created', (e) => {
      try {
        const stub = JSON.parse(e.data) as Stub;
        set(state => {
          if (state.stubs.some(s => s.id === stub.id)) {
            return { stubs: state.stubs.map(s => s.id === stub.id ? stub : s) };
          }
          return { stubs: [...state.stubs, stub] };
        });
      } catch { /* ignore */ }
    });

    subscribeSse('stub:updated', (e) => {
      try {
        const stub = JSON.parse(e.data) as Stub;
        set(state => ({
          stubs: state.stubs.map(s => s.id === stub.id ? stub : s),
        }));
      } catch { /* ignore */ }
    });

    subscribeSse('stub:deleted', (e) => {
      try {
        const { id } = JSON.parse(e.data) as { id: string };
        set(state => ({
          stubs: state.stubs.filter(s => s.id !== id),
        }));
      } catch { /* ignore */ }
    });

    subscribeSse('stub:cursor-changed', (e) => {
      try {
        const { id, pool, cursor } = JSON.parse(e.data) as { id: string; pool: 'responses' | 'faults'; cursor: number };
        set(state => ({
          stubs: state.stubs.map(s => s.id !== id ? s : {
            ...s,
            [pool]: { ...s[pool], cursor },
          }),
        }));
      } catch { /* ignore */ }
    });

    subscribeSse('state:dirty', (e) => {
      try {
        const { dirty } = JSON.parse(e.data) as { dirty: boolean };
        set({ dirty });
      } catch { /* ignore */ }
    });
  },

  refreshSettings: async () => {
    try {
      const res = await fetch('/settings');
      const settings = await jsonOk<ServerSettings>(res);
      set({ serverMode: settings.mode, strict: settings.strict, autoSave: settings.autoSave });
    } catch { /* keep state */ }
  },

  setServerSettings: async (patch) => {
    const res = await fetch('/settings', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(patch),
    });
    const settings = await jsonOk<ServerSettings>(res);
    set({ serverMode: settings.mode, strict: settings.strict, autoSave: settings.autoSave });
  },

  refresh: async () => {
    set({ loading: true });
    try {
      const res = await fetch('/stubs');
      const stubs = await jsonOk<Stub[]>(res);
      set({ stubs });
    } catch { /* keep state */ }
    finally { set({ loading: false }); }
  },

  update: async (id, patch) => {
    const res = await fetch(`/stubs/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(patch),
    });
    await jsonOk<Stub>(res);
  },

  updateResponse: async (stubId, responseId, patch) => {
    const res = await fetch(`/stubs/${stubId}/responses/${responseId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(patch),
    });
    await jsonOk<Stub>(res);
  },

  createStub: async (data) => {
    const res = await fetch('/stubs', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(data),
    });
    return await jsonOk<Stub>(res);
  },

  addResponse: async (stubId, pool, data) => {
    const res = await fetch(`/stubs/${stubId}/responses`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...data, pool }),
    });
    await jsonOk<Stub>(res);
  },

  deleteStub: async (id) => {
    const res = await fetch(`/stubs/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      throw new Error(`Request failed: ${res.status}`);
    }
  },

  deleteResponse: async (stubId, responseId) => {
    const res = await fetch(`/stubs/${stubId}/responses/${responseId}`, { method: 'DELETE' });
    await jsonOk<Stub>(res);
  },

  reorderResponses: async (stubId, pool, orderedIds) => {
    const res = await fetch(`/stubs/${stubId}/responses/order`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pool, order: orderedIds }),
    });
    await jsonOk<Stub>(res);
  },

  resetCursor: async (stubId, pool) => {
    await fetch(`/stubs/${stubId}/cursor/reset`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pool }),
    });
  },

  setCursor: async (stubId, pool, cursor) => {
    await fetch(`/stubs/${stubId}/cursor`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pool, cursor }),
    });
  },

  save: async () => {
    await fetch('/save', { method: 'POST' });
  },

  reset: async () => {
    await fetch('/reset', { method: 'POST' });
    window.location.reload();
  },
}));
