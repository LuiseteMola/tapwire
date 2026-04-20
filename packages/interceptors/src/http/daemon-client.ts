import http from 'node:http';
import type { HttpMethod, Resolution, BodyCaptureStatus, CaptureServedStatus, CapturedNetworkError, StackFrame } from '@tapwire/shared';

// ---------------------------------------------------------------------------
// Saved original reference — MUST be at module level, before any interceptor
// applies. DaemonClient uses this for all outbound calls so they are never
// intercepted, preventing an infinite resolve loop.
// ---------------------------------------------------------------------------
const _originalRequest = http.request.bind(http);

export type ResolveResult = Resolution & { captureId: string };

export class DaemonClient {
  constructor(private readonly daemonUrl: string) {}

  async resolve(
    method: HttpMethod,
    url: string,
    requestHeaders: Record<string, string>,
    requestBody: unknown,
    initiator?: StackFrame[],
  ): Promise<ResolveResult> {
    return await this.request(
      'POST',
      '/resolve',
      { method, url, requestHeaders, requestBody, initiator },
      { 'x-tapwire-internal': 'true' },
    ) as ResolveResult;
  }

  async submitCapture(
    captureId: string,
    served: Exclude<CaptureServedStatus, 'in-flight'>,
    responseStatus: number,
    responseHeaders: Record<string, string>,
    responseBody: unknown,
    latencyMs: number,
    bodyCaptured: BodyCaptureStatus,
    networkError?: CapturedNetworkError,
  ): Promise<void> {
    await this.request('PATCH', `/captures/${captureId}`, {
      served,
      responseStatus,
      responseHeaders,
      responseBody,
      latencyMs,
      bodyCaptured,
      networkError,
    });
  }

  private request(
    method: string,
    path: string,
    body: unknown,
    extraHeaders: Record<string, string> = {},
  ): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const target = new URL(path, this.daemonUrl);
      const data = JSON.stringify(body);

      const req = _originalRequest(
        {
          hostname: target.hostname,
          port: Number(target.port) || 80,
          path: target.pathname,
          method,
          headers: {
            'content-type': 'application/json',
            'content-length': Buffer.byteLength(data),
            ...extraHeaders,
          },
        },
        (res) => {
          let raw = '';
          res.on('data', (chunk: string) => { raw += chunk; });
          res.on('end', () => {
            try { resolve(JSON.parse(raw)); }
            catch { resolve(null); }
          });
        },
      );

      req.on('error', reject);
      req.write(data);
      req.end();
    });
  }
}
