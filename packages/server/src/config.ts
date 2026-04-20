import type { TapwireConfig } from '@tapwire/shared';

export const DEFAULT_CONFIG: TapwireConfig = {
  port: 4000,
  fixturesDir: '.tapwire/fixtures',
  mode: 'default',
  captureInitiator: true,
  scrub: {
    headers: [
      'authorization',
      'cookie',
      'set-cookie',
      'x-api-key',
      'x-auth-token',
      'x-session-token',
    ],
    replaceWith: '[REDACTED]',
  },
  capture: {
    maxBodySize: '10mb',
  },
};
