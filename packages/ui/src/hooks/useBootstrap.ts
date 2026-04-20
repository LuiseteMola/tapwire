import { useEffect } from 'react';
import { useCaptureStore, useStubStore } from '../store';

/** Initializes all global stores on first mount. */
export function useBootstrap(): void {
  useEffect(() => {
    // Load initial state
    useStubStore.getState().refresh();
    useStubStore.getState().refreshSettings();

    // Subscribe to SSE events
    useStubStore.getState().initSSE();
    useCaptureStore.getState().init();

    return () => useCaptureStore.getState().dispose();
  }, []);
}
