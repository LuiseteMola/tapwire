import { describe, it, expect } from 'vitest';
import { shouldCaptureBody, isTextContent } from './is-capturable';

describe('shouldCaptureBody', () => {
  // Capturable types
  it('captures application/json', () => {
    expect(shouldCaptureBody('application/json')).toBe(true);
  });

  it('captures text/html', () => {
    expect(shouldCaptureBody('text/html')).toBe(true);
  });

  it('captures text/csv', () => {
    expect(shouldCaptureBody('text/csv')).toBe(true);
  });

  it('captures image/png (small binary)', () => {
    expect(shouldCaptureBody('image/png')).toBe(true);
  });

  it('captures with no content-type', () => {
    expect(shouldCaptureBody(null)).toBe(true);
  });

  it('ignores charset params', () => {
    expect(shouldCaptureBody('application/json; charset=utf-8')).toBe(true);
  });

  // Skipped types
  it('skips video/*', () => {
    expect(shouldCaptureBody('video/mp4')).toBe('non-capturable-content');
  });

  it('skips audio/*', () => {
    expect(shouldCaptureBody('audio/mpeg')).toBe('non-capturable-content');
  });

  it('skips font/*', () => {
    expect(shouldCaptureBody('font/woff2')).toBe('non-capturable-content');
  });

  it('skips application/zip', () => {
    expect(shouldCaptureBody('application/zip')).toBe('non-capturable-content');
  });

  it('skips application/octet-stream', () => {
    expect(shouldCaptureBody('application/octet-stream')).toBe('non-capturable-content');
  });

  it('skips application/wasm', () => {
    expect(shouldCaptureBody('application/wasm')).toBe('non-capturable-content');
  });

  // Max size
  it('returns max-size-exceeded when body exceeds limit', () => {
    expect(shouldCaptureBody('application/json', 2_000_000, 1_000_000)).toBe('max-size-exceeded');
  });

  it('captures when body is under limit', () => {
    expect(shouldCaptureBody('application/json', 500, 1_000_000)).toBe(true);
  });

  // Case insensitive
  it('matching is case-insensitive', () => {
    expect(shouldCaptureBody('Video/MP4')).toBe('non-capturable-content');
  });
});

describe('isTextContent', () => {
  it('text/* is text', () => {
    expect(isTextContent('text/plain')).toBe(true);
    expect(isTextContent('text/html')).toBe(true);
    expect(isTextContent('text/csv')).toBe(true);
  });

  it('application/json is text', () => {
    expect(isTextContent('application/json')).toBe(true);
    expect(isTextContent('application/json; charset=utf-8')).toBe(true);
  });

  it('application/xml is text', () => {
    expect(isTextContent('application/xml')).toBe(true);
  });

  it('+json suffix is text', () => {
    expect(isTextContent('application/vnd.api+json')).toBe(true);
  });

  it('+xml suffix is text', () => {
    expect(isTextContent('application/soap+xml')).toBe(true);
  });

  it('application/x-www-form-urlencoded is text', () => {
    expect(isTextContent('application/x-www-form-urlencoded')).toBe(true);
  });

  it('image/png is not text', () => {
    expect(isTextContent('image/png')).toBe(false);
  });

  it('application/pdf is not text', () => {
    expect(isTextContent('application/pdf')).toBe(false);
  });

  it('null is not text', () => {
    expect(isTextContent(null)).toBe(false);
  });
});
