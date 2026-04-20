import http from 'node:http';
import https from 'node:https';
import { AsyncLocalStorage } from 'node:async_hooks';
import type { StackFrame } from '@tapwire/shared';
import { captureRawCallSites } from './capture-raw-call-sites';
import { filterCallSites } from './filter-call-sites';

/**
 * Captures the call stack at the point where an HTTP request originates,
 * and propagates it via AsyncLocalStorage so downstream async handlers
 * (e.g. MSW's request event) can read it.
 *
 * Wraps http.request, https.request, http.get, https.get, and globalThis.fetch.
 */
export class CallStackCapture {
  private readonly _store = new AsyncLocalStorage<StackFrame[]>();

  /** Returns the stack frames captured for the current async context, or []. */
  getFrames(): StackFrame[] {
    return this._store.getStore() ?? [];
  }

  /** Wraps http/https/fetch to capture call stacks. Call before or after MSW patches. */
  apply(): void {
    this._wrapModule(http);
    this._wrapModule(https);
    this._wrapFetch();
  }

  // ---------------------------------------------------------------------------
  // Stack capture
  // ---------------------------------------------------------------------------

  /** Captures and filters the current call stack into clean StackFrame[]. */
  private _capture(): StackFrame[] {
    return filterCallSites(captureRawCallSites(this._capture));
  }

  // ---------------------------------------------------------------------------
  // Wrappers
  // ---------------------------------------------------------------------------

  /** Wraps http/https .request() and .get() to capture the call stack. */
  private _wrapModule(mod: typeof http | typeof https): void {
    const originalRequest = mod.request;
    mod.request = ((...args: unknown[]) => {
      const stack = this._capture();
      return this._store.run(stack, () => (originalRequest as Function)(...args));
    }) as typeof mod.request;

    const originalGet = mod.get;
    mod.get = ((...args: unknown[]) => {
      const stack = this._capture();
      return this._store.run(stack, () => (originalGet as Function)(...args));
    }) as typeof mod.get;
  }

  /** Wraps globalThis.fetch to capture the call stack. */
  private _wrapFetch(): void {
    const originalFetch = globalThis.fetch;
    if (!originalFetch) {
      return;
    }

    globalThis.fetch = (...args: Parameters<typeof fetch>) => {
      const stack = this._capture();
      return this._store.run(stack, () => originalFetch(...args));
    };
  }
}
