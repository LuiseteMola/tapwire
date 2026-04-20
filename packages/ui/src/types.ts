export type {
  HttpMethod,
  ResponseMode,
  StubMode,
  ServerMode,
  ServerSettings,
  StackFrame,
  NetworkError,
  CapturedNetworkError,
  EventType,
  StubResponse,
  StubConfig,
  ResponsePool,
  Stub,
  CaptureServedStatus,
  BodyCaptureStatus,
  CapturedRequest,
  RequestEvent,
  Resolution,
} from '@tapwire/shared';

import type { Resolution, CapturedRequest, CapturedNetworkError, CaptureServedStatus, EventType, HttpMethod } from '@tapwire/shared';

export type ResolutionType = Resolution['type'];

/** Unified item shown in the live feed. */
export interface FeedItem {
  id: string;
  type: EventType;
  resolutionType?: ResolutionType;
  stubId?: string;
  method: HttpMethod;
  url: string;
  pathname: string;
  served?: CaptureServedStatus;
  networkError?: CapturedNetworkError;
  statusCode?: number;
  latencyMs?: number;
  timestamp: string;
  stubPattern?: string;
  /** Present only for 'captured' events — the full request/response pair. */
  capture?: CapturedRequest;
  /** Present for 'matched' events — inbound request headers/body. */
  requestHeaders?: Record<string, string>;
  requestBody?: unknown;
  /** Present for 'matched' events — stub response headers/body. */
  responseHeaders?: Record<string, string>;
  responseBody?: unknown;
}
