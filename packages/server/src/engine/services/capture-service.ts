import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import type { CaptureStore } from '../stores';
import type {
  BodyCaptureStatus,
  CapturedRequest,
  CaptureServedStatus,
  HttpMethod,
  CapturedNetworkError,
  Resolution,
  StackFrame,
} from '@tapwire/shared';

export interface CaptureInput {
  method: HttpMethod;
  url: string;
  host: string;
  pathname: string;
  requestHeaders: Record<string, string>;
  requestBody?: unknown;
  resolution: Resolution;
  initiator?: StackFrame[];
}

export interface CompleteInput {
  served: Exclude<CaptureServedStatus, 'in-flight'>;
  responseStatus: number;
  responseHeaders: Record<string, string>;
  responseBody: unknown;
  latencyMs: number;
  bodyCaptured?: BodyCaptureStatus;
  networkError?: CapturedNetworkError;
}

export class CaptureService extends EventEmitter {
  constructor(
    private readonly captures: CaptureStore,
  ) {
    super();
  }

  /**
   * Creates a pending capture for an in-flight request.
   * Emits 'capture:created' with the request event.
   * Returns the capture ID.
   */
  create(input: CaptureInput): string {
    const captureId = randomUUID();
    const now = new Date().toISOString();
    const stub = (input.resolution.type !== 'passthrough' && input.resolution.type !== 'rejected')
      ? input.resolution.stub
      : undefined;

    const capture: CapturedRequest = {
      id: captureId,
      served: 'in-flight',
      resolutionType: input.resolution.type,
      ...(stub && { stubId: stub.id }),
      method: input.method,
      url: input.url,
      host: input.host,
      pathname: input.pathname,
      requestHeaders: input.requestHeaders,
      requestBody: input.requestBody ?? null,
      capturedAt: now,
      promoted: false,
      ...(input.initiator?.length && { initiator: input.initiator }),
    };

    this.captures.add(capture);
    this.emit('capture:created', capture);

    return captureId;
  }

  /**
   * Completes a pending capture with response data.
   *
   * Emits 'capture:completed' — the engine handles recording-mode
   * logic separately.
   *
   * Returns the completed capture, or null if the capture ID is unknown.
   */
  complete(captureId: string, input: CompleteInput): CapturedRequest | null {
    const capture = this.captures.get(captureId);
    if (!capture) {
      return null;
    }

    const captured = this.captures.update(capture.id, {
      served: input.served,
      responseStatus: input.responseStatus,
      responseHeaders: input.responseHeaders,
      responseBody: input.responseBody,
      bodyCaptured: input.bodyCaptured,
      latencyMs: input.latencyMs,
      ...(input.networkError && { networkError: input.networkError }),
    });

    if (!captured) {
      return null;
    }

    this.emit('capture:completed', captured);

    return captured;
  }

  /**
   * Marks a capture as promoted and links it to the target stub.
   * Emits 'capture:promoted' with the updated capture.
   */
  markPromoted(captureId: string, stubId: string): void {
    this.captures.markPromoted(captureId, stubId);
    const capture = this.captures.get(captureId);
    if (capture) {
      this.emit('capture:promoted', capture);
    }
  }

}
