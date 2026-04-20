import type { CapturedRequest } from '@tapwire/shared';

export class CaptureStore {
  private readonly entries = new Map<string, CapturedRequest>();
  private readonly maxSize: number;

  /**
   * @param maxSize Maximum number of captures to keep in memory.
   *   When exceeded, the oldest entry is silently dropped.
   *   Defaults to 5000. Override via constructor or TAPWIRE_INBOX_SIZE env var.
   */
  constructor(maxSize = 5000) {
    if (process.env.TAPWIRE_INBOX_SIZE) {
      const parsed = parseInt(process.env.TAPWIRE_INBOX_SIZE, 10);
      if (!isNaN(parsed) && parsed > 0) {
        this.maxSize = parsed;
        return;        
      }
    }
    this.maxSize = maxSize;
  }

  /** Appends a capture. Drops the oldest if maxSize is exceeded. */
  add(capture: CapturedRequest): void {
    this.entries.set(capture.id, capture);
    if (this.entries.size > this.maxSize) {
      const oldest = this.entries.keys().next().value!;
      this.entries.delete(oldest);
    }
  }

  remove(id: string): void {
    this.entries.delete(id);
  }

  get(id: string): CapturedRequest | undefined {
    return this.entries.get(id);
  }

  /** Returns all captures in chronological order (oldest first). */
  getAll(): CapturedRequest[] {
    return Array.from(this.entries.values());
  }

  clear(): void {
    this.entries.clear();
  }

  /** Merges partial data into an existing capture. Used to complete a pending capture. */
  update(id: string, data: Partial<CapturedRequest>): CapturedRequest | undefined {
    const entry = this.entries.get(id);
    if (entry) {
      Object.assign(entry, data);
    }
    return entry;
  }

  /** Marks a capture as promoted and links it to the created stub. */
  markPromoted(id: string, stubId: string): void {
    const entry = this.entries.get(id);
    if (!entry) {
      return;
    }
    entry.promoted = true;
    entry.stubId = stubId;
  }

  get size(): number {
    return this.entries.size;
  }
}
