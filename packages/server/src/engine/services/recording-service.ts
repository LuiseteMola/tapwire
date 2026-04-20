import type { CaptureStore } from '../stores';
import type { CaptureService } from './capture-service';
import type { StubService } from './stub-service';
import type {
  CapturedRequest,
  HttpMethod,
  ScrubConfig,
  ServerMode,
  Stub,
} from '@tapwire/shared';

export class RecordingService {
  constructor(
    private readonly captures: CaptureStore,
    private readonly captureService: CaptureService,
    private readonly stubService: StubService,
    private readonly scrubConfig: ScrubConfig,
  ) {}

  /**
   * Promotes a capture to a reusable stub.
   *
   * Scrubs sensitive headers, creates a stub via StubService, appends the
   * captured response, and marks the capture as promoted.
   *
   * Returns the created stub, or null if the capture ID is unknown.
   */
  promote(captureId: string, pattern: string, method: HttpMethod, host: string): Stub | null {
    const capture = this.captures.get(captureId);
    if (!capture) {
      return null;
    }

    const stub = this.stubService.create({ method, host, pattern, mode: 'mock' });
    this.addCaptureToStub(capture, stub.id);
    this.captureService.markPromoted(capture.id, stub.id);

    return this.stubService.get(stub.id)!;
  }

  /**
   * Adds a capture's response to an existing stub.
   * Scrubs sensitive headers and marks the capture as promoted.
   *
   * Returns the updated stub, or null if the capture or stub ID is unknown.
   */
  addToStub(captureId: string, stubId: string): Stub | null {
    const capture = this.captures.get(captureId);
    if (!capture) {
      return null;
    }

    const stub = this.stubService.get(stubId);
    if (!stub) {
      return null;
    }

    this.addCaptureToStub(capture, stubId);
    this.captures.markPromoted(capture.id, stubId);

    return this.stubService.get(stubId)!;
  }

  /**
   * If the completed capture's stub is in record mode (or the server mode
   * overrides to record), scrubs the capture and appends the response to
   * the stub's pool via StubService.
   */
  handleRecording(captureId: string, serverMode: ServerMode = 'default'): void {
    const capture = this.captures.get(captureId);
    if (!capture?.stubId) {
      return;
    }

    const stub = this.stubService.get(capture.stubId);
    if (!stub) {
      return;
    }
    if (stub.mode !== 'record' && serverMode !== 'record') {
      return;
    }

    this.addCaptureToStub(capture, stub.id);
  }

  private addCaptureToStub(capture: CapturedRequest, stubId: string): void {
    const scrubbed = this.scrub(capture);

    this.stubService.addResponse(stubId, 'responses', {
      statusCode: scrubbed.responseStatus ?? 0,
      body: scrubbed.responseBody ?? null,
      headers: scrubbed.responseHeaders ?? {},
      capturedAt: scrubbed.capturedAt,
      host: scrubbed.host,
      latencyMs: scrubbed.latencyMs,
    });
  }

  private scrub(capture: CapturedRequest): CapturedRequest {
    const scrubHeaders = (headers: Record<string, string>): Record<string, string> =>
      Object.fromEntries(
        Object.entries(headers).map(([key, value]) =>
          this.scrubConfig.headers.includes(key.toLowerCase())
            ? [key, this.scrubConfig.replaceWith]
            : [key, value],
        ),
      );

    return {
      ...capture,
      requestHeaders: scrubHeaders(capture.requestHeaders),
      responseHeaders: capture.responseHeaders ? scrubHeaders(capture.responseHeaders) : undefined,
    };
  }
}
