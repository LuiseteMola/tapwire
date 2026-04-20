import { EventEmitter } from 'node:events';
import { StubStore, CaptureStore } from './stores';
import { ResolveService, CaptureService, StubService, RecordingService } from './services';
import type { CompleteInput } from './services';
import type { CreateStubInput, UpdateStubInput } from './services';
import type { StateStore } from '../storage';
import type {
  CapturedRequest,
  HttpMethod,
  Resolution,
  ScrubConfig,
  ServerMode,
  ServerSettings,
  StackFrame,
  Stub,
  StubResponse,
} from '@tapwire/shared';

export interface TapwireEngineConfig {
  stateStore: StateStore;
  scrubConfig: ScrubConfig;
  mode?: ServerMode;
}

export interface ResolveInput {
  method: HttpMethod;
  url: string;
  requestHeaders: Record<string, string>;
  requestBody?: unknown;
  initiator?: StackFrame[];
}

export type ResolveResult = Resolution & { captureId: string };

export class TapwireEngine extends EventEmitter {
  private readonly resolveService: ResolveService;
  private readonly captureService: CaptureService;
  private readonly stubService: StubService;
  private readonly recordingService: RecordingService;
  private readonly stubs: StubStore;
  private readonly captures: CaptureStore;
  private readonly stateStore: StateStore;
  private _dirty = false;
  private _serverMode: ServerMode;
  private _strict = false;
  private _autoSave = false;
  private _autoSaveTimer: ReturnType<typeof setTimeout> | null = null;

  private constructor(config: TapwireEngineConfig) {
    super();

    this._serverMode = config.mode ?? 'default';
    this.stateStore = config.stateStore;
    this.stubs = new StubStore();
    this.captures = new CaptureStore();
    this.resolveService = new ResolveService(this.stubs);
    this.captureService = new CaptureService(this.captures);
    this.stubService = new StubService(this.stubs);
    this.recordingService = new RecordingService(
      this.captures, this.captureService, this.stubService, config.scrubConfig,
    );

    // Bubble service events
    this.captureService.on('capture:created', (event) => this.emit('capture:created', event));
    this.captureService.on('capture:completed', (event) => this.emit('capture:completed', event));
    this.captureService.on('capture:promoted', (event) => this.emit('capture:promoted', event));
    this.stubService.on('stub:created', (stub) => { this.markDirty(); this.emit('stub:created', stub); });
    this.stubService.on('stub:updated', (stub) => { this.markDirty(); this.emit('stub:updated', stub); });
    this.stubService.on('stub:deleted', (event) => { this.markDirty(); this.emit('stub:deleted', event); });
    this.stubService.on('stub:cursor-changed', (event) => { this.markDirty(); this.emit('stub:cursor-changed', event); });
    this.resolveService.on('stub:cursor-changed', (event) => { this.markDirty(); this.emit('stub:cursor-changed', event); });
  }

  static async create(config: TapwireEngineConfig): Promise<TapwireEngine> {
    const engine = new TapwireEngine(config);
    await engine.load();
    return engine;
  }

  // ---------------------------------------------------------------------------
  // Server settings
  // ---------------------------------------------------------------------------

  get serverMode(): ServerMode {
    return this._serverMode;
  }

  get strict(): boolean {
    return this._strict;
  }

  get autoSave(): boolean {
    return this._autoSave;
  }

  get serverSettings(): ServerSettings {
    return { mode: this._serverMode, strict: this._strict, autoSave: this._autoSave };
  }

  setServerSettings(settings: Partial<ServerSettings>): void {
    if (settings.mode !== undefined) {
      this._serverMode = settings.mode;
    }
    if (settings.strict !== undefined) {
      this._strict = settings.strict;
    }
    if (settings.autoSave !== undefined) {
      this._autoSave = settings.autoSave;
    }
  }

  // ---------------------------------------------------------------------------
  // Persistence
  // ---------------------------------------------------------------------------

  async save(): Promise<void> {
    await this.stateStore.flush({ stubs: this.stubs.getAll() });
    this.clearDirty();
  }

  private scheduleAutoSave(): void {
    if (!this._autoSave) {
      return;
    }
    if (this._autoSaveTimer) {
      clearTimeout(this._autoSaveTimer);
    }
    this._autoSaveTimer = setTimeout(() => {
      this._autoSaveTimer = null;
      this.save().catch(() => {});
    }, 500);
  }

  async load(): Promise<void> {
    this.stubs.clear();
    this.captures.clear();
    const snapshot = await this.stateStore.load();
    snapshot.stubs.forEach(stub => this.stubs.add(stub));
    this.clearDirty();
  }

  private markDirty(): void {
    if (!this._dirty) {
      this._dirty = true;
      this.emit('state:dirty', { dirty: true });
    }
    this.scheduleAutoSave();
  }

  private clearDirty(): void {
    if (this._dirty) {
      this._dirty = false;
      this.emit('state:dirty', { dirty: false });
    }
  }

  get dirty(): boolean {
    return this._dirty;
  }

  // ---------------------------------------------------------------------------
  // Resolve
  // ---------------------------------------------------------------------------

  resolve(input: ResolveInput): ResolveResult {
    const parsedUrl = new URL(input.url);
    const baseResolution = this.resolveService.resolve(input.method, parsedUrl.hostname, parsedUrl.pathname);
    const resolution = this._applyServerMode(baseResolution);

    const captureId = this.captureService.create({
      method: input.method,
      url: input.url,
      host: parsedUrl.hostname,
      pathname: parsedUrl.pathname,
      requestHeaders: input.requestHeaders,
      requestBody: input.requestBody,
      resolution,
      initiator: input.initiator,
    });

    return { ...resolution, captureId };
  }

  private _applyServerMode(base: Resolution): Resolution {
    if (this._serverMode === 'default') {
      return base;
    }

    // Unmatched request
    if (base.type === 'passthrough') {
      if (this._strict && (this._serverMode === 'mock' || this._serverMode === 'record')) {
        return { type: 'rejected', statusCode: 501, message: `No matching stub (server mode: ${this._serverMode}, strict)` };
      }
      return base;
    }

    // Matched request — override stub mode based on server mode
    const stub = 'stub' in base ? base.stub : undefined;
    if (!stub) {
      return base;
    }

    switch (this._serverMode) {
      case 'mock':
        return this.resolveService.resolveAsMock(stub);
      case 'proxy':
        return { type: 'proxy', stub };
      case 'record':
        return { type: 'record', stub };
      default:
        return base;
    }
  }

  // ---------------------------------------------------------------------------
  // Captures
  // ---------------------------------------------------------------------------

  completeCapture(captureId: string, input: CompleteInput): CapturedRequest | null {
    const captured = this.captureService.complete(captureId, input);
    if (!captured) {
      return null;
    }

    this.recordingService.handleRecording(captureId, this._serverMode);

    // Auto-promote passthrough captures in record + passthrough mode
    if (
      this._serverMode === 'record'
      && !this._strict
      && captured.resolutionType === 'passthrough'
      && captured.served === 'served'
    ) {
      this.recordingService.promote(captureId, captured.pathname, captured.method, captured.host);
    }

    return captured;
  }

  promote(captureId: string, pattern: string, method: HttpMethod, host: string): Stub | null {
    return this.recordingService.promote(captureId, pattern, method, host);
  }

  addCaptureToStub(captureId: string, stubId: string): Stub | null {
    return this.recordingService.addToStub(captureId, stubId);
  }

  getCaptures(): CapturedRequest[] {
    return this.captures.getAll();
  }

  getCapture(id: string): CapturedRequest | undefined {
    return this.captures.get(id);
  }

  clearCaptures(): void {
    this.captures.clear();
  }

  // ---------------------------------------------------------------------------
  // Stubs
  // ---------------------------------------------------------------------------

  getStubs(): Stub[] {
    return this.stubService.list();
  }

  getStub(id: string): Stub | null {
    return this.stubService.get(id);
  }

  createStub(input: CreateStubInput): Stub {
    return this.stubService.create(input);
  }

  updateStub(id: string, input: UpdateStubInput): Stub | null {
    return this.stubService.update(id, input);
  }

  removeStub(id: string): boolean {
    return this.stubService.remove(id);
  }

  addResponse(stubId: string, pool: 'responses' | 'faults', data: Omit<StubResponse, 'id'>): Stub | null {
    return this.stubService.addResponse(stubId, pool, data);
  }

  updateResponse(stubId: string, responseId: string, patch: Partial<StubResponse>): Stub | null {
    return this.stubService.updateResponse(stubId, responseId, patch);
  }

  removeResponse(stubId: string, responseId: string): Stub | null {
    return this.stubService.removeResponse(stubId, responseId);
  }

  reorderResponses(stubId: string, pool: 'responses' | 'faults', orderedIds: string[]): Stub | null {
    return this.stubService.reorderResponses(stubId, pool, orderedIds);
  }

  resetCursor(stubId: string, pool: 'responses' | 'faults'): Stub | null {
    return this.stubService.resetCursor(stubId, pool);
  }

  setCursor(stubId: string, pool: 'responses' | 'faults', cursor: number): Stub | null {
    return this.stubService.setCursor(stubId, pool, cursor);
  }

  // ---------------------------------------------------------------------------
  // System
  // ---------------------------------------------------------------------------

  async reset(): Promise<void> {
    await this.load();
  }

  get stubCount(): number {
    return this.stubs.getAll().length;
  }

  get captureCount(): number {
    return this.captures.size;
  }
}
