import { gunzipSync, inflateSync, brotliDecompressSync } from 'node:zlib';
import { isTextContent } from './is-capturable';

/** Headers that should be stripped when serving mock responses. */
const HOP_BY_HOP = new Set([
  'content-encoding', 'transfer-encoding', 'connection',
  'keep-alive', 'te', 'trailers', 'upgrade', 'content-length',
]);

/** Removes hop-by-hop headers from a headers object. */
export function filterHopByHopHeaders(headers: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(headers).filter(([k]) => !HOP_BY_HOP.has(k.toLowerCase())),
  );
}

/** Decompresses a response body buffer based on the Content-Encoding header. */
export function decompressBody(buf: Buffer, encoding: string | null): Buffer {
  if (!encoding || encoding === 'identity') {
    return buf;
  }
  try {
    switch (encoding) {
      case 'gzip':    return gunzipSync(buf);
      case 'deflate': return inflateSync(buf);
      case 'br':      return brotliDecompressSync(buf);
      default:        return buf;
    }
  } catch {
    // Interceptor may have already decompressed despite leaving the header intact
    return buf;
  }
}

/** Parses a decoded response buffer into a storable body value. */
export function parseResponseBody(decoded: Buffer, contentType: string): unknown {
  if (decoded.length === 0) {
    return null;
  }

  if (isTextContent(contentType)) {
    const text = decoded.toString('utf-8');
    try {
      return JSON.parse(text);
    } catch {
      return text || null;
    }
  }

  const mimeType = contentType.split(';')[0].trim();
  return `data:${mimeType};base64,${decoded.toString('base64')}`;
}

/** Extracts the request body from a Request object based on content type. */
export async function getRequestBody(request: Request, contentType: string): Promise<unknown> {
  if (!contentType) {
    return null;
  }

  if (contentType.includes('application/json')) {
    try {
      return await request.clone().json();
    } catch {
      return null;
    }
  }

  if (isTextContent(contentType)) {
    try {
      return await request.clone().text();
    } catch {
      return null;
    }
  }

  return null;
}
