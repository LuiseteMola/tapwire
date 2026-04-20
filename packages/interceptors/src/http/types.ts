import type { ClientRequestInterceptor } from '@mswjs/interceptors/ClientRequest';
import type { FetchInterceptor } from '@mswjs/interceptors/fetch';
import type { HttpMethod } from '@tapwire/shared';

export interface PendingCapture {
  captureId: string;
  method: HttpMethod;
  url: string;
  startTime: number;
}

export type InterceptorList = [ClientRequestInterceptor, FetchInterceptor];
