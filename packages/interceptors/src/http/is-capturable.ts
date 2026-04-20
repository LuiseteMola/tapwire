import type { BodyCaptureStatus } from '@tapwire/shared';

/** Content-type prefixes that should never be captured (large binary formats). */
const SKIP_PREFIXES = ['video/', 'audio/', 'font/'];

/** Exact content-types that should never be captured. */
const SKIP_EXACT = new Set([
  'application/zip',
  'application/gzip',
  'application/x-tar',
  'application/x-7z-compressed',
  'application/x-rar-compressed',
  'application/octet-stream',
  'application/wasm',
]);

/**
 * Determines whether a response body should be captured.
 *
 * Uses a blacklist approach — everything is captured except known
 * large binary formats (video, audio, fonts, archives). Images and
 * other small binaries are captured as base64.
 *
 * @param contentType  The response Content-Type header value
 * @param bodySize     Content-Length if known (in bytes)
 * @param maxSize      Maximum capture size in bytes
 * @returns            `true` if capturable, or a skip reason string
 */
export function shouldCaptureBody(
  contentType: string | null,
  bodySize?: number,
  maxSize?: number,
): BodyCaptureStatus {
  if (!contentType) return true; // no content-type header — try to capture

  const baseType = contentType.split(';')[0].trim().toLowerCase();

  if (SKIP_EXACT.has(baseType)) return 'non-capturable-content';
  if (SKIP_PREFIXES.some(prefix => baseType.startsWith(prefix))) return 'non-capturable-content';
  if (maxSize && bodySize && bodySize > maxSize) return 'max-size-exceeded';

  return true;
}

/**
 * Returns true if the content-type is text-based (can be stored as a string).
 * Binary content that passes shouldCaptureBody (e.g. images) should be
 * stored as base64 instead.
 */
export function isTextContent(contentType: string | null): boolean {
  if (!contentType) return false;
  const baseType = contentType.split(';')[0].trim().toLowerCase();

  if (baseType.startsWith('text/')) return true;
  if (baseType.startsWith('application/json')) return true;
  if (baseType.startsWith('application/xml')) return true;
  if (baseType.endsWith('+json')) return true;
  if (baseType.endsWith('+xml')) return true;
  if (baseType === 'application/x-www-form-urlencoded') return true;

  return false;
}
