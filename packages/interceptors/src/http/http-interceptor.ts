import { BatchInterceptor, HttpRequestEventMap, RequestController, getRawRequest } from '@mswjs/interceptors';
import { ClientRequestInterceptor } from '@mswjs/interceptors/ClientRequest';
import { FetchInterceptor } from '@mswjs/interceptors/fetch';
import http from 'node:http';
import type { HttpMethod, StubResponse, StubConfig, BodyCaptureStatus, StackFrame } from '@tapwire/shared';
import { shouldCaptureBody } from './is-capturable';
import { filterHopByHopHeaders, decompressBody, parseResponseBody, getRequestBody } from './body-utils';
import { DaemonClient } from './daemon-client';
import type { PendingCapture, InterceptorList } from './types';

const DEBUG = process.env.TAPWIRE_DEBUG === 'true';
const log = (...args: unknown[]) => { if (DEBUG) console.log(...args); };

export interface HttpInterceptorOptions {
  getInitiator?: () => StackFrame[];
}

export class HttpInterceptor {
  private readonly _interceptor: BatchInterceptor<InterceptorList, HttpRequestEventMap>;
  private readonly _pendingCaptures = new Map<string, PendingCapture>();
  private readonly _client: DaemonClient;
  private readonly _getInitiator: () => StackFrame[];

  constructor(daemonUrl: string, options: HttpInterceptorOptions = {}) {
    this._client = new DaemonClient(daemonUrl);
    this._getInitiator = options.getInitiator ?? (() => []);
    this._interceptor = new BatchInterceptor<InterceptorList, HttpRequestEventMap>({
      name: 'tapwire',
      interceptors: [new ClientRequestInterceptor(), new FetchInterceptor()],
    });
  }

  apply(): void {
    this._interceptor.on('request', (args) => {
      log(`[tapwire:event] request — ${args.request.method} ${args.request.url} (id=${args.requestId})`);
      return this._onRequest(args);
    });
    this._interceptor.on('response', (args) => {
      log(`[tapwire:event] response — ${args.request.method} ${args.request.url} status=${args.response.status} mocked=${args.isMockedResponse} (id=${args.requestId})`);
      return this._onResponse(args);
    });
    this._interceptor.on('unhandledException', (args) => {
      const errMsg = args.error instanceof Error ? args.error.message : String(args.error);
      log(`[tapwire:event] unhandledException — ${args.request.method} ${args.request.url} error="${errMsg}" (id=${args.requestId})`);
      return this._onError(args);
    });
    this._interceptor.apply();
  }

  dispose(): void {
    this._interceptor.dispose();
  }

  // -------------------------------------------------------------------------
  // Resolution handlers
  // -------------------------------------------------------------------------

  private async _handleMock(
    resolution: { captureId: string; response: StubResponse; stub: { config: StubConfig } },
    controller: RequestController,
    method: HttpMethod,
    url: string,
    startTime: number,
  ): Promise<void> {
    log(`[tapwire:register] resolved mock — ${method} ${url}`);

    const { response, stub } = resolution;

    const delay = stub.config.replayDelay && response.latencyMs
      ? response.latencyMs
      : stub.config.delayMs;

    if (delay && delay > 0) {
      await new Promise(r => setTimeout(r, delay));
    }

    controller.respondWith(
      new Response(JSON.stringify(response.body), {
        status: response.statusCode,
        headers: { 'content-type': 'application/json', ...filterHopByHopHeaders(response.headers) },
      }),
    );

    await this._client.submitCapture(
      resolution.captureId,
      'served',
      response.statusCode,
      response.headers,
      response.body,
      Date.now() - startTime,
      true,
    );
  }

  private async _handleNetworkError(
    resolution: { captureId: string; errorCode: string; errorMessage: string; stub: { config: StubConfig } },
    controller: RequestController,
    method: HttpMethod,
    url: string,
    startTime: number,
  ): Promise<void> {
    log(`[tapwire:register] resolved network-error (${resolution.errorCode}) — ${method} ${url}`);

    const { stub } = resolution;

    if (stub.config.delayMs && stub.config.delayMs > 0) {
      await new Promise(r => setTimeout(r, stub.config.delayMs));
    }

    const error = new Error(resolution.errorMessage);
    (error as NodeJS.ErrnoException).code = resolution.errorCode;
    controller.errorWith(error);

    await this._client.submitCapture(
      resolution.captureId,
      'served',
      0,
      {},
      null,
      Date.now() - startTime,
      true,
    );
  }

  private async _handleRejected(
    resolution: { captureId: string; message: string },
    controller: RequestController,
    method: HttpMethod,
    url: string,
    startTime: number,
  ): Promise<void> {
    log(`[tapwire:register] resolved rejected — ${method} ${url}`);

    const body = { error: 'tapwire:no_stub', method, url, message: resolution.message };

    controller.respondWith(
      new Response(JSON.stringify(body), {
        status: 501,
        headers: { 'content-type': 'application/json' },
      }),
    );

    await this._client.submitCapture(
      resolution.captureId,
      'served',
      501,
      { 'content-type': 'application/json' },
      body,
      Date.now() - startTime,
      true,
    );
  }

  private _handlePassthrough(
    resolution: { type: string; captureId: string },
    request: Request,
    requestId: string,
    method: HttpMethod,
    url: string,
    startTime: number,
  ): void {
    log(`[tapwire:register] resolved ${resolution.type} — ${method} ${url}`);

    this._pendingCaptures.set(requestId, {
      captureId: resolution.captureId,
      method,
      url,
      startTime,
    });
    this._listenForAbort(request, requestId);
  }

  // -------------------------------------------------------------------------
  // Interceptor event handlers
  // -------------------------------------------------------------------------

  private async _resolve(
    method: HttpMethod,
    url: string,
    requestHeaders: Record<string, string>,
    requestBody: unknown,
    initiator: StackFrame[],
  ) {
    try {
      return await this._client.resolve(method, url, requestHeaders, requestBody, initiator);
    } catch (err) {
      log(`[tapwire:register] daemon unreachable — ${method} ${url}`, err);
      return null;
    }
  }

  private async _onRequest({ request, requestId, controller }: {
    request: Request;
    requestId: string;
    controller: RequestController;
  }): Promise<void> {
    const method = request.method as HttpMethod;
    const url = request.url;
    const requestHeaders = Object.fromEntries(request.headers.entries());
    const startTime = Date.now();

    const initiator = this._getInitiator();
    const requestBody = await getRequestBody(request, requestHeaders['content-type'] ?? '') ?? null;
    const resolution = await this._resolve(method, url, requestHeaders, requestBody, initiator);

    switch (resolution?.type) {
      case 'mock':
        return this._handleMock(resolution, controller, method, url, startTime);
      case 'network-error':
        return this._handleNetworkError(resolution, controller, method, url, startTime);
      case 'rejected':
        return this._handleRejected(resolution, controller, method, url, startTime);
      case 'proxy':
      case 'record':
      case 'passthrough':
        return this._handlePassthrough(resolution, request, requestId, method, url, startTime);
      default:
        log(`[tapwire:register] unknown resolution type — ${method} ${url}`, resolution);
        return;
    }
  }

  private async _onError({ error, request, requestId }: {
    error: unknown;
    request: Request;
    requestId: string;
  }): Promise<void> {
    const pending = this._pendingCaptures.get(requestId);
    if (!pending) {
      return;
    }
    this._pendingCaptures.delete(requestId);

    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorCode = error instanceof Error ? (error as NodeJS.ErrnoException).code ?? 'ERR_UNKNOWN' : 'ERR_UNKNOWN';

    try {
      await this._client.submitCapture(
        pending.captureId,
        'error',
        0,
        {},
        null,
        Date.now() - pending.startTime,
        true,
        { code: errorCode, message: errorMessage, source: 'network' as const },
      );
      log(`[tapwire:register] captured error — ${pending.method} ${pending.url} error=${errorCode}`);
    } catch (err) {
      log(`[tapwire:register] failed to submit error capture — ${pending.method} ${pending.url}`, err);
    }
  }

  private _listenForAbort(request: Request, requestId: string): void {
    const rawRequest = getRawRequest(request);

    if (rawRequest instanceof http.ClientRequest) {
      let destroyedByClient = false;
      const origDestroy = rawRequest.destroy.bind(rawRequest);
      rawRequest.destroy = (err?: Error) => {
        destroyedByClient = true;
        return origDestroy(err);
      };

      if (rawRequest.destroyed) {
        this._onAbort(requestId, undefined, 'abort');
        return;
      }
      rawRequest.on('error', (err: Error) => {
        const source = destroyedByClient ? 'abort' as const : 'network' as const;
        log(`[tapwire:event] rawRequest error (${source}) — ${request.method} ${request.url} error="${err.message}" (id=${requestId})`);
        this._onAbort(requestId, err, source);
      });
    } else {
      if (request.signal.aborted) {
        const reason = request.signal.reason;
        const err = reason instanceof Error ? reason : new Error(String(reason ?? 'Request aborted'));
        log(`[tapwire:event] signal already aborted — ${request.method} ${request.url} error="${err.message}" (id=${requestId})`);
        this._onAbort(requestId, err, 'abort');
        return;
      }
      request.signal.addEventListener('abort', () => {
        const reason = request.signal.reason;
        const err = reason instanceof Error ? reason : new Error(String(reason ?? 'Request aborted'));
        log(`[tapwire:event] signal abort — ${request.method} ${request.url} error="${err.message}" (id=${requestId})`);
        this._onAbort(requestId, err, 'abort');
      });
    }
  }

  private async _onAbort(requestId: string, error: Error | undefined, source: 'abort' | 'network'): Promise<void> {
    const pending = this._pendingCaptures.get(requestId);
    if (!pending) {
      return;
    }
    this._pendingCaptures.delete(requestId);

    const errorCode = (error as NodeJS.ErrnoException)?.code ?? error?.name ?? 'ECONNABORTED';
    const errorMessage = error?.message ?? 'Request aborted';

    try {
      await this._client.submitCapture(
        pending.captureId,
        'error',
        0,
        {},
        null,
        Date.now() - pending.startTime,
        true,
        { code: errorCode, message: errorMessage, source },
      );
      log(`[tapwire:register] captured ${source} — ${pending.method} ${pending.url} error=${errorCode}`);
    } catch (err) {
      log(`[tapwire:register] failed to submit abort capture — ${pending.method} ${pending.url}`, err);
    }
  }

  private async _onResponse({ response, requestId }: {
    response: Response;
    requestId: string;
  }): Promise<void> {
    const pending = this._pendingCaptures.get(requestId);
    if (!pending) {
      return;
    }
    this._pendingCaptures.delete(requestId);

    const status = response.status;
    const contentType = response.headers.get('content-type') ?? '';
    const contentLength = Number(response.headers.get('content-length')) || undefined;
    const responseHeaders = Object.fromEntries(response.headers.entries());

    let responseBody: unknown = null;
    let bodyCaptured: BodyCaptureStatus = shouldCaptureBody(contentType, contentLength);

    if (bodyCaptured === true) {
      try {
        const rawBuffer = Buffer.from(await response.clone().arrayBuffer());

        const encoding = response.headers.get('content-encoding');
        const decoded = decompressBody(rawBuffer, encoding);
        responseBody = parseResponseBody(decoded, contentType);
      } catch {
        bodyCaptured = 'read-error';
      }
    }

    try {
      await this._client.submitCapture(
        pending.captureId,
        'served',
        status,
        responseHeaders,
        responseBody,
        Date.now() - pending.startTime,
        bodyCaptured,
      );
      log(`[tapwire:register] captured — ${pending.method} ${pending.url} status=${status}`);
    } catch (err) {
      log(`[tapwire:register] failed to submit capture — ${pending.method} ${pending.url}`, err);
    }
  }
}
