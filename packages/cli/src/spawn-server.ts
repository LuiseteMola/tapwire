import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';

/**
 * Spawns the Tapwire server as a child process.
 * Returns the ChildProcess so the caller can forward signals and wait for exit.
 */
export function spawnServer(opts: {
  port: number;
  fixturesDir: string;
  mode?: string;
}): ChildProcess {
  const serverEntry = path.join(__dirname, 'server.js');

  return spawn(process.execPath, [serverEntry], {
    env: {
      ...process.env,
      TAPWIRE_PORT: String(opts.port),
      TAPWIRE_FIXTURES_DIR: opts.fixturesDir,
      TAPWIRE_MODE: opts.mode ?? 'default',
    },
    stdio: ['ignore', 'inherit', 'inherit'],
  });
}
