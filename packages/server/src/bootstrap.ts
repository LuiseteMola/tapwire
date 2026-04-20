import { TapwireEngine } from './engine';
import type { TapwireConfig } from '@tapwire/shared';
import { FsStateStore } from './storage';
import { SseEmitter } from './sse-emitter';
import { createServer } from './server';

export async function bootstrap(config: TapwireConfig) {
  const stateStore = new FsStateStore(config.fixturesDir);

  const engine = await TapwireEngine.create({
    stateStore,
    scrubConfig: config.scrub,
    mode: config.mode,
  });

  const sseEmitter = new SseEmitter();

  // Route engine events to SSE
  engine.on('capture:created', (event) => sseEmitter.emit('capture:created', event));
  engine.on('capture:completed', (event) => sseEmitter.emit('capture:completed', event));
  engine.on('capture:promoted', (event) => sseEmitter.emit('capture:promoted', event));
  engine.on('stub:created', (stub) => sseEmitter.emit('stub:created', stub));
  engine.on('stub:updated', (stub) => sseEmitter.emit('stub:updated', stub));
  engine.on('stub:deleted', (data) => sseEmitter.emit('stub:deleted', data));
  engine.on('stub:cursor-changed', (data) => sseEmitter.emit('stub:cursor-changed', data));
  engine.on('state:dirty', (data) => sseEmitter.emit('state:dirty', data));

  const app = createServer({ engine, sseEmitter });

  return { app, engine };
}
