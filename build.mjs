import { build } from 'esbuild';
import { execSync } from 'node:child_process';
import { cpSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { readFileSync } from 'node:fs';

// Clean previous build
rmSync('dist', { recursive: true, force: true });
mkdirSync('dist');

// 1. Build UI (Vite)
execSync('npm run build:ui', { stdio: 'inherit' });

// 2. Bundle server + CLI and interceptors (esbuild)
const shared = {
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'cjs',
  sourcemap: true,
};

await Promise.all([
  build({
    ...shared,
    entryPoints: ['packages/cli/src/index.ts'],
    outfile: 'dist/cli.js',
    external: ['hono', '@hono/node-server', 'path-to-regexp'],
  }),
  build({
    ...shared,
    entryPoints: ['packages/server/src/index.ts'],
    outfile: 'dist/server.js',
    external: ['hono', '@hono/node-server', 'path-to-regexp'],
  }),
  build({
    ...shared,
    entryPoints: ['packages/interceptors/src/index.ts'],
    outfile: 'dist/register.js',
    external: ['@mswjs/interceptors'],
  }),
]);

// 3. Copy UI assets next to the bundles
cpSync('packages/ui/dist', 'dist/ui', { recursive: true });

// 4. Generate bin entry point (path relative to dist/)
mkdirSync('dist/bin');
writeFileSync('dist/bin/tapwire', '#!/usr/bin/env node\nrequire(\'../cli.js\');\n', { mode: 0o755 });

// 5. Generate publish-ready package.json
const source = JSON.parse(readFileSync('packages/cli/package.json', 'utf-8'));

const publishPkg = {
  name: source.name,
  version: source.version,
  description: source.description,
  bin: { tapwire: 'bin/tapwire' },
  engines: source.engines,
  keywords: source.keywords,
  license: source.license,
  dependencies: source.dependencies,
  repository: source.repository,
};

writeFileSync('dist/package.json', JSON.stringify(publishPkg, null, 2) + '\n');
