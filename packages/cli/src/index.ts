import { spawn } from 'node:child_process';
import path from 'node:path';
import { spawnServer } from './spawn-server';
import { waitFor } from './wait-for';

// ---------------------------------------------------------------------------
// Arg parsing
// ---------------------------------------------------------------------------

interface CliArgs {
  port: number;
  fixturesDir: string;
  mode: string;
  command: string[];
}

function parseArgs(argv: string[]): CliArgs {
  // argv: ['node', '<script>', ...user args]
  const args = argv.slice(2);
  let port = Number(process.env.TAPWIRE_PORT) || 4000;
  let fixturesDir = '.tapwire/fixtures';
  let mode = 'default';
  let commandStart = args.length;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--') {
      commandStart = i + 1;
      break;
    }
    if (args[i] === '--port' && args[i + 1] !== undefined) {
      port = Number(args[++i]);
    } else if (args[i] === '--fixtures' && args[i + 1] !== undefined) {
      fixturesDir = args[++i];
    } else if (args[i] === '--mode' && args[i + 1] !== undefined) {
      mode = args[++i];
    }
  }

  return { port, fixturesDir, mode, command: args.slice(commandStart) };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const { port, fixturesDir, mode, command } = parseArgs(process.argv);

  if (command.length === 0) {
    console.error(
      'Usage: tapwire [--port 4000] [--fixtures .tapwire/fixtures] [--mode default] -- <command>',
    );
    process.exit(1);
  }

  // 1. Spawn server
  const server = spawnServer({ port, fixturesDir, mode });

  server.on('error', (err) => {
    console.error('[tapwire] Failed to start server:', err.message);
    process.exit(1);
  });

  // 2. Wait for the server health endpoint to respond
  try {
    await waitFor(`http://127.0.0.1:${port}/health`, 10_000);
  } catch {
    console.error('[tapwire] Server did not become ready in time');
    server.kill();
    process.exit(1);
  }

  console.log(`[tapwire] Server ready — http://127.0.0.1:${port}`);

  // 3. Resolve the interceptors entry point from the bundle
  const interceptorsPath = path.join(__dirname, 'register.js');

  // 4. Inject interceptors and spawn the user's process
  const nodeOptions = `--require ${interceptorsPath}`;
  const existingNodeOptions = process.env.NODE_OPTIONS ?? '';
  const mergedNodeOptions = existingNodeOptions
    ? `${existingNodeOptions} ${nodeOptions}`
    : nodeOptions;

  const [bin, ...binArgs] = command;
  const child = spawn(bin, binArgs, {
    env: {
      ...process.env,
      NODE_OPTIONS: mergedNodeOptions,
      TAPWIRE_PORT: String(port),
    },
    stdio: 'inherit',
  });

  // 5. Signal forwarding
  const forwardSignal = (signal: NodeJS.Signals): void => {
    child.kill(signal);
    server.kill(signal);
  };

  process.on('SIGINT', () => forwardSignal('SIGINT'));
  process.on('SIGTERM', () => forwardSignal('SIGTERM'));

  // 6. Exit coordination — user's process drives the exit code
  child.on('exit', (code) => {
    server.kill();
    process.exit(code ?? 0);
  });

  server.on('exit', (code, signal) => {
    if (signal) return; // killed by us, ignore
    if (code !== null && code !== 0) {
      console.error(`[tapwire] Server exited unexpectedly (code ${code})`);
      child.kill();
      process.exit(code);
    }
  });
}

main().catch((err: unknown) => {
  console.error('[tapwire] Unexpected error:', err);
  process.exit(1);
});
