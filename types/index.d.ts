// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

/** HTTP methods Tapwire intercepts and matches against. */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

/** How a stub cycles through its response pool. */
export type ResponseMode = 'fixed' | 'sequential' | 'random';

/**
 * Network-level errors that can be simulated by a stub.
 * Unlike HTTP status codes (where the server responds), these represent
 * connection failures where no HTTP response is received at all.
 */
export type NetworkError =
  | 'none'
  | 'connection-reset'
  | 'connection-aborted'
  | 'timeout'
  | 'dns-not-found'
  | 'connection-refused';

/**
 * What the stub does when a request matches it.
 * - mock:   serve a response from the local pool
 * - proxy:  forward to the real upstream, do not capture
 * - record: forward to the real upstream and capture the response
 */
export type StubMode = 'mock' | 'proxy' | 'record';

/**
 * Server-wide mode that overrides per-stub behavior.
 * - default: no override, each stub governs itself
 * - mock:    force all matched stubs to serve mock responses
 * - proxy:   force all matched stubs to proxy to upstream
 * - record:  force all matched stubs to proxy + append response to stub
 */
export type ServerMode = 'default' | 'mock' | 'proxy' | 'record';

/** Server-wide settings for mode and strict toggle. */
export interface ServerSettings {
  mode: ServerMode;
  /** When true, unmatched requests are rejected (501). Only effective in mock and record modes. */
  strict: boolean;
  /** When true, stubs are automatically saved to disk on every change. */
  autoSave: boolean;
}

/**
 * What happened to a request as it passed through Tapwire.
 * - captured:    proxied to the real server and added to the inbox
 * - matched:     served from a stub's response pool
 * - proxied:     forwarded to the real server (stub in proxy/record mode)
 * - passthrough: no stub matched and content-type is not capturable
 * - replayed:    manually replayed by the developer from the inbox
 */
export type EventType = 'captured' | 'matched' | 'network-error' | 'proxied' | 'passthrough' | 'replayed' | 'pending' | 'completed';

/** Lifecycle + outcome state of a capture in the inbox. */
export type CaptureServedStatus = 'in-flight' | 'served' | 'error';

/** Whether the error was caused by a programmatic abort or a real network failure. */
export type NetworkErrorSource = 'abort' | 'network';

/** A single frame in a captured call stack (initiator). */
export interface StackFrame {
  /** Absolute or relative file path. */
  file: string;
  /** Line number in the source file. */
  line: number;
  /** Column number in the source file. */
  column: number;
  /** Function or method name. */
  fn: string;
}

/** Network-level error details attached to a capture when served is 'error'. */
export interface CapturedNetworkError {
  code: string;
  message: string;
  source: NetworkErrorSource;
}

/** Whether the response body was captured, or the reason it was skipped. */
export type BodyCaptureStatus = true | 'non-capturable-content' | 'max-size-exceeded' | 'read-error';

// ---------------------------------------------------------------------------
// Responses
// ---------------------------------------------------------------------------

/** A single response variant stored in a stub's pool. */
export interface StubResponse {
  /** Stable identifier — used to target this response for removal or editing. */
  id: string;
  /** HTTP status code returned to the caller. */
  statusCode: number;
  /** Response body. Stored as-captured; serialised to JSON when served. */
  body: unknown;
  /** Response headers returned to the caller. */
  headers: Record<string, string>;
  /** Human-readable label shown in the UI: "Happy path", "Rate limited", etc. */
  label?: string;
  /** ISO timestamp — set when this response was promoted from a capture. */
  capturedAt?: string;
  /** Hostname the response was originally captured from: "api.stripe.com" */
  host?: string;
  /** Round-trip latency recorded at capture time, in milliseconds. */
  latencyMs?: number;
}

/**
 * A collection of responses and the rules for cycling through them.
 * Used for both the responses pool and the faults pool on a stub.
 */
export interface ResponsePool {
  /** How the next response is selected on each incoming request. */
  mode: ResponseMode;
  /**
   * Current position for sequential mode. -1 means never used.
   * Mutated by the engine on each sequential pick.
   */
  cursor: number;
  /** ID of the response to serve in fixed mode. Falls back to the first response if unset. */
  activeResponseId?: string;
  responses: StubResponse[];
}

// ---------------------------------------------------------------------------
// Stubs
// ---------------------------------------------------------------------------

/** Behavioural settings for a stub — all runtime-configurable without restart. */
export interface StubConfig {
  /**
   * 0–100. Percentage of incoming requests that are served from the faults
   * pool instead of the responses pool.
   */
  failureRate: number;
  /**
   * When set, every response from this stub uses this status code regardless
   * of what is stored in the pool. Useful for forcing 503s across the board.
   */
  forcedStatusCode?: number;
  /** Delay applied to every response on this stub, in milliseconds. */
  delayMs?: number;
  /** When true, use each response's recorded latencyMs instead of the fixed delayMs. */
  replayDelay?: boolean;
  /**
   * When set to a value other than 'none', the stub will simulate a
   * network-level error instead of returning an HTTP response.
   * Mutually exclusive with normal response serving.
   */
  networkError?: NetworkError;
}

/** A mock rule: matches incoming requests and decides how to respond. */
export interface Stub {
  /** Stable identifier — used by the Admin API and fixture filenames. */
  id: string;
  /** HTTP method this stub matches. */
  method: HttpMethod;
  /** Hostname this stub matches: "api.stripe.com", "api.github.com" */
  host: string;
  /** Express-style route pattern: /users/:id, /orgs/:org/repos/:repo */
  pattern: string;
  /** What the stub does when a request matches. */
  mode: StubMode;
  /** Behavioural configuration. */
  config: StubConfig;
  /** Real responses — captured or manually added. Served under normal conditions. */
  responses: ResponsePool;
  /** Synthetic faults — developer-crafted error responses for chaos injection (based on failureRate). */
  faults: ResponsePool;
}

// ---------------------------------------------------------------------------
// Captures
// ---------------------------------------------------------------------------

/**
 * A single intercepted request+response pair.
 * Lives only in the in-memory inbox — never written to disk as-is.
 * Sensitive data is scrubbed before any fixture is persisted.
 */
export interface CapturedRequest {
  /** Stable identifier — used when promoting to a stub or replaying. */
  id: string;
  /** Lifecycle + outcome: in-flight while pending, served once response received, error on network failure. */
  served: CaptureServedStatus;
  /** Present when served is 'error' — the network-level error that prevented the response. */
  networkError?: CapturedNetworkError;
  /** How the engine resolved this request. */
  resolutionType: Resolution['type'];
  /** ID of the stub that matched this request. Set for mock/proxy resolutions. */
  stubId?: string;
  method: HttpMethod;
  /** Full URL as intercepted, including protocol, host, path, and query string. */
  url: string;
  /** Hostname extracted from the URL: "api.example.com" */
  host: string;
  /** Path only, without query string: "/users/123" */
  pathname: string;
  requestHeaders: Record<string, string>;
  requestBody: unknown;
  /** Set when served is 'served' or 'error'. */
  responseStatus?: number;
  /** Set when served is 'served' or 'error'. */
  responseHeaders?: Record<string, string>;
  /** Set when served is 'served' or 'error'. */
  responseBody?: unknown;
  /** Whether the response body was captured, or the reason it was skipped. Set when served is 'served'. */
  bodyCaptured?: BodyCaptureStatus;
  /** Round-trip time from request start to response end. Set when served is 'served' or 'error'. */
  latencyMs?: number;
  /** ISO timestamp of when the request was intercepted. */
  capturedAt: string;
  /** True once this capture has been promoted to a stub. Set by the daemon, shown in the UI. */
  promoted: boolean;
  /** Call stack frames showing where in the user's code this request originated. */
  initiator?: StackFrame[];
}

// ---------------------------------------------------------------------------
// Engine resolution
// ---------------------------------------------------------------------------

/**
 * The decision the engine makes for each incoming request.
 * Discriminated union — use a switch on `type` for exhaustive handling.
 *
 * - mock:          serve `response` locally; do not contact the real server
 * - network-error: simulate a network-level failure (no HTTP response)
 * - proxy:         forward to the real server; `stub` provides upstream context
 * - passthrough:   no stub matched or content is not capturable; forward as-is
 */
export type Resolution =
  | { type: 'mock';          stub: Stub; response: StubResponse }
  | { type: 'network-error'; stub: Stub; errorCode: string; errorMessage: string }
  | { type: 'proxy';         stub: Stub }
  | { type: 'record';        stub: Stub }
  | { type: 'passthrough'                                       }
  | { type: 'rejected';      statusCode: 501; message: string   };

// ---------------------------------------------------------------------------
// Live feed events
// ---------------------------------------------------------------------------

/**
 * Lightweight summary of a resolved request.
 * Emitted by the daemon and streamed to the UI via Server-Sent Events.
 */
export interface RequestEvent {
  /** Stable identifier — matches the CapturedRequest id when type is 'captured'. */
  id: string;
  /** ISO timestamp. */
  timestamp: string;
  method: HttpMethod;
  url: string;
  /** Absent while in-flight, set on completion. */
  statusCode?: number;
  /** Absent while in-flight, set on completion. */
  latencyMs?: number;
  type: EventType;
  /** Set on completion — whether the upstream served a response or a network error occurred. */
  served?: CaptureServedStatus;
  /** Present when served is 'error' — the network-level error details. */
  networkError?: CapturedNetworkError;
  /** How the engine resolved this request: mock, proxy, or passthrough. */
  resolutionType?: Resolution['type'];
  /** ID of the stub that matched. Set for mock/proxy resolutions. */
  stubId?: string;
  /** Set when resolved by a stub — the pattern that matched. */
  stubPattern?: string;
  /** Set when type is 'passthrough' — reason why capture was skipped, e.g. 'image/png'. */
  passthruReason?: string;
  /** Present for 'matched' events — the inbound request headers and body. */
  requestHeaders?: Record<string, string>;
  requestBody?: unknown;
  /** Present for 'matched' events — the stub response headers and body. */
  responseHeaders?: Record<string, string>;
  responseBody?: unknown;
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Headers scrubbed from captured data before fixture persistence. */
export interface ScrubConfig {
  /** Header names to redact. Matched case-insensitively. */
  headers: string[];
  /** Replacement value written into the fixture. Default: '[REDACTED]' */
  replaceWith: string;
}

/** Controls what Tapwire captures from the traffic stream. */
export interface CaptureConfig {
  /** Maximum body size to capture. Bodies over this limit are stored without body. Default: '10mb' */
  maxBodySize: string;
}

/** Top-level Tapwire runtime configuration. */
export interface TapwireConfig {
  /** Port the daemon's Admin API listens on. Default: 4000 */
  port: number;
  /** Directory where fixture JSON files are read from and written to. Default: .tapwire/fixtures */
  fixturesDir: string;
  /** Initial server-wide mode. Default: 'default' */
  mode: ServerMode;
  /** Whether to capture call stack initiator frames. Default: true */
  captureInitiator: boolean;
  scrub: ScrubConfig;
  capture: CaptureConfig;
}

// ---------------------------------------------------------------------------
// Promote
// ---------------------------------------------------------------------------

/** Payload sent to POST /captures/:id/promote */
export interface PromoteRequest {
  /** ID of the CapturedRequest to promote. */
  captureId: string;
  /** The parameterised pattern the developer defined: /users/:id */
  pattern: string;
  /** HTTP method for the new stub. Pre-filled from the capture, editable in the UI. */
  method: HttpMethod;
  /** Hostname for the new stub. Pre-filled from the capture. */
  host: string;
}
