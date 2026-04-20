import type { Stub } from '@tapwire/shared';

export interface StateSnapshot {
  stubs: Stub[];
}

/** Storage contract for persisting engine state. */
export interface StateStore {
  load(): Promise<StateSnapshot>;
  flush(snapshot: StateSnapshot): Promise<void>;
}
