import { create } from 'zustand';
import type { CapturedRequest, FeedItem } from '../types';
import { subscribeSse, initSseConnection, disposeSseConnection } from './sse-connection';

function captureToFeedItem(capture: CapturedRequest): FeedItem {
  return {
    id: capture.id,
    type: capture.served === 'in-flight' ? 'pending' : 'completed',
    resolutionType: capture.resolutionType,
    stubId: capture.stubId,
    method: capture.method,
    url: capture.url,
    pathname: capture.pathname,
    served: capture.served,
    networkError: capture.networkError,
    statusCode: capture.responseStatus,
    latencyMs: capture.latencyMs,
    timestamp: capture.capturedAt,
    capture,
  };
}

interface CaptureState {
  items: FeedItem[];

  // Actions
  init: () => void;
  dispose: () => void;
  clearAll: () => Promise<void>;
  promote: (captureId: string, pattern: string, method: string, host: string) => Promise<boolean>;
  addToStub: (captureId: string, stubId: string) => Promise<boolean>;
}

export const useCaptureStore = create<CaptureState>((set) => ({
  items: [],

  init: () => {
    // Load initial state
    fetch('/captures')
      .then(r => r.json())
      .then((data: CapturedRequest[]) => set({ items: data.map(captureToFeedItem) }))
      .catch(() => {});

    // SSE push: new capture created
    subscribeSse('capture:created', (e) => {
      try {
        const capture = JSON.parse(e.data) as CapturedRequest;
        set(state => {
          if (state.items.some(i => i.id === capture.id)) {
            return state;
          }
          return { items: [...state.items, captureToFeedItem(capture)] };
        });
      } catch { /* ignore */ }
    });

    // SSE push: capture completed with response data
    subscribeSse('capture:completed', (e) => {
      try {
        const capture = JSON.parse(e.data) as CapturedRequest;
        set(state => ({
          items: state.items.map(item =>
            item.id === capture.id ? captureToFeedItem(capture) : item,
          ),
        }));
      } catch { /* ignore */ }
    });

    // SSE push: capture promoted to a stub
    subscribeSse('capture:promoted', (e) => {
      try {
        const capture = JSON.parse(e.data) as CapturedRequest;
        set(state => ({
          items: state.items.map(item =>
            item.id === capture.id ? captureToFeedItem(capture) : item,
          ),
        }));
      } catch { /* ignore */ }
    });

    initSseConnection();
  },

  dispose: () => {
    disposeSseConnection();
  },

  clearAll: async () => {
    await fetch('/captures', { method: 'DELETE' });
    set({ items: [] });
  },

  promote: async (captureId, pattern, method, host) => {
    const res = await fetch(`/captures/${captureId}/promote`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pattern, method, host }),
    });
    return res.ok;
  },

  addToStub: async (captureId, stubId) => {
    const res = await fetch(`/captures/${captureId}/add-to-stub`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ stubId }),
    });
    return res.ok;
  },
}));
