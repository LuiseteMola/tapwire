import { serve } from '@hono/node-server';
import { bootstrap } from './bootstrap';
import { DEFAULT_CONFIG } from './config';

import type { ServerMode } from '@tapwire/shared';

const port = Number(process.env.TAPWIRE_PORT) || DEFAULT_CONFIG.port;
const fixturesDir = process.env.TAPWIRE_FIXTURES_DIR ?? DEFAULT_CONFIG.fixturesDir;
const mode = (process.env.TAPWIRE_MODE as ServerMode | undefined) ?? DEFAULT_CONFIG.mode;

const config = { ...DEFAULT_CONFIG, port, fixturesDir, mode };

bootstrap(config).then(({ app }) => {
  serve({ fetch: app.fetch, port }, () => {
    console.log(`Tapwire ready on http://localhost:${port}`);
  });
});
