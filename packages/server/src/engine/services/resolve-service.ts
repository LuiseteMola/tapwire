import { EventEmitter } from 'node:events';
import type { StubStore } from '../stores';
import type { HttpMethod, NetworkError, Resolution, Stub, StubResponse } from '@tapwire/shared';

/** Maps NetworkError values to Node.js error codes and messages. */
const NETWORK_ERROR_MAP: Record<Exclude<NetworkError, 'none'>, { code: string; message: string }> = {
  'connection-reset':   { code: 'ECONNRESET',  message: 'socket hang up' },
  'connection-aborted': { code: 'ECONNABORTED', message: 'socket hang up' },
  'timeout':            { code: 'ETIMEDOUT',    message: 'connect ETIMEDOUT' },
  'dns-not-found':      { code: 'ENOTFOUND',    message: 'getaddrinfo ENOTFOUND' },
  'connection-refused': { code: 'ECONNREFUSED', message: 'connect ECONNREFUSED' },
};

export class ResolveService extends EventEmitter {
  /**
   * Injectable random source — defaults to Math.random.
   * Pass a deterministic function in tests to control failure injection.
   */
  private readonly rand: () => number;

  constructor(
    private readonly stubs: StubStore,
    rand: () => number = Math.random,
  ) {
    super();
    this.rand = rand;
  }

  /**
   * Core decision point: given a method, host and pathname, returns what
   * Tapwire should do with the request.
   *
   * Resolution types:
   *   passthrough — no stub matched; forward to real server without capture
   *   proxy       — stub matched but is in proxy/record mode; forward to real server
   *   mock        — stub matched in mock mode; serve a response from the pool
   *   network-error — stub matched; simulate a connection-level failure
   */
  resolve(method: HttpMethod, host: string, pathname: string): Resolution {
    const stub = this.stubs.match(method, host, pathname);

    if (!stub) {
      return { type: 'passthrough' };
    }

    if (stub.mode === 'proxy') {
      return { type: 'proxy', stub };
    }
    if (stub.mode === 'record') {
      return { type: 'record', stub };
    }

    return this.resolveAsMock(stub);
  }

  /**
   * Forces a mock resolution for a stub — used both internally and by the
   * engine when server mode overrides a stub to mock.
   */
  resolveAsMock(stub: Stub): Resolution {
    // network-error mode — simulate a connection-level failure
    const networkError = stub.config.networkError;
    if (networkError && networkError !== 'none') {
      const { code, message } = NETWORK_ERROR_MAP[networkError];
      return { type: 'network-error', stub, errorCode: code, errorMessage: message };
    }

    // mock mode — pick from responses or faults pool based on failureRate
    const shouldFail = this.rand() * 100 < stub.config.failureRate;
    const response = this.nextResponse(stub, shouldFail ? 'faults' : 'responses');
    return { type: 'mock', stub, response };
  }

  /**
   * Picks the next response from a stub's pool according to its mode.
   *
   * Modes:
   *   fixed:      always returns the same response (cursor index, default 0)
   *   sequential: advances through responses in order, wraps around
   *   random:     picks randomly on every call
   *
   * If forcedStatusCode is set on the stub config, the returned response will
   * have its statusCode overridden — the rest of the response is unchanged.
   */
  nextResponse(stub: Stub, pool: 'responses' | 'faults'): StubResponse {
    const responsePool = stub[pool];
    const { responses } = responsePool;

    if (responses.length === 0) {
      throw new Error(
        `Stub "${stub.method} ${stub.pattern}" has no responses in the ${pool} pool`,
      );
    }

    let response: StubResponse;

    switch (responsePool.mode) {
      case 'fixed':
        response = (responsePool.activeResponseId
          ? responses.find(r => r.id === responsePool.activeResponseId)
          : undefined) ?? responses[0];
        break;

      case 'sequential':
        responsePool.cursor = (responsePool.cursor + 1) % responses.length;
        response = responses[responsePool.cursor];
        this.emit('stub:cursor-changed', { id: stub.id, pool, cursor: responsePool.cursor });
        break;

      case 'random':
        response = responses[Math.floor(this.rand() * responses.length)];
        break;
    }

    if (stub.config.forcedStatusCode !== undefined) {
      return { ...response, statusCode: stub.config.forcedStatusCode };
    }

    return response;
  }
}
