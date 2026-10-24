/**
 * Durable, idempotent write queue for gate-entry marks.
 *
 * Why this exists
 * ---------------
 * Marking a vendor as entered used to be a raw Supabase round-trip from the
 * click handler. At a busy gate that means:
 *   - the confirmation waits on the network, and
 *   - a dropped connection / expired token silently loses the mark.
 *
 * This queue makes the write fire-and-forget from the UI's point of view:
 *
 *   1. `set()` records the ABSOLUTE desired `check_in_time` (not a toggle), so
 *      replaying it is always safe.
 *   2. Rapid marks for the same vendor coalesce — last value wins, so
 *      double-taps can never leave the server out of order.
 *   3. Writes are persisted to `localStorage`, so a reload / crash while
 *      offline does not lose them. They replay when the tab comes back.
 *   4. Failed writes retry with exponential backoff + jitter; only permanent
 *      failures (bad row, permission denied, constraint violation) are
 *      surfaced and removed.
 *   5. Writes for the same vendor are serialized; different vendors run with
 *      bounded concurrency so a burst of marks still drains quickly.
 *
 * The queue is deliberately framework-free and DOM-free (storage is injected),
 * which keeps it unit-testable in plain Node.
 */

export type GateEntryValue = string | null;

export interface GateEntrySnapshot {
  /** Marks still waiting to reach the server. */
  pendingCount: number;
  /** True while at least one write is in flight. */
  syncing: boolean;
}

export interface GateEntryStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}

export interface GateEntryQueueOptions {
  /** Performs the actual write. Must reject on failure. */
  write: (id: string, value: GateEntryValue) => Promise<void>;
  /** Storage adapter. Pass `null` to run memory-only (tests / SSR). */
  storage?: GateEntryStorage | null;
  storageKey?: string;
  /** Parallel writes across DIFFERENT vendors. Same-vendor writes stay serialized. */
  concurrency?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  now?: () => number;
  random?: () => number;
  isPermanentError?: (error: unknown) => boolean;
  /** Fired whenever the pending/syncing snapshot changes. */
  onChange?: (snapshot: GateEntrySnapshot) => void;
  /** Fired once a mark is confirmed by the server (or superseded by a newer mark). */
  onSettled?: (id: string, value: GateEntryValue) => void;
  /** Fired when a mark can never succeed without operator action. */
  onPermanentError?: (id: string, value: GateEntryValue, error: unknown) => void;
}

interface QueueEntry {
  id: string;
  value: GateEntryValue;
  attempts: number;
  nextAttemptAt: number;
}

interface PersistedQueue {
  version: 1;
  entries: QueueEntry[];
}

const DEFAULT_STORAGE_KEY = 'quonnect.gate-entry.v1';
const DEFAULT_CONCURRENCY = 4;
const DEFAULT_BASE_DELAY_MS = 500;
const DEFAULT_MAX_DELAY_MS = 30_000;
const MAX_JITTER_MS = 250;

/** PostgREST / Postgres errors that retrying cannot fix. */
function defaultIsPermanentError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as {
    permanent?: boolean;
    status?: number;
    statusCode?: number;
    code?: string;
  };

  if (candidate.permanent === true) return true;

  const status = Number(candidate.status ?? candidate.statusCode ?? 0);
  // 401 (expired session) and 408/429 (timeout / rate limit) are worth retrying.
  if (status >= 400 && status < 500 && status !== 401 && status !== 408 && status !== 429) {
    return true;
  }

  const code = String(candidate.code ?? '');
  if (code.startsWith('PGRST3') && code !== 'PGRST301') return true;
  if (code === 'PGRST116') return true; // no row matched / RLS hid it
  return (
    code === '42501' || // insufficient privilege (RLS)
    code === '42P01' || // undefined table
    code === '42703' || // undefined column
    code === '23502' || // not-null violation
    code === '23503' || // foreign-key violation
    code === '23514' || // check violation
    code === '22P02' // invalid text representation
  );
}

function resolveDefaultStorage(): GateEntryStorage | null {
  try {
    if (typeof window === 'undefined') return null;
    return window.localStorage;
  } catch {
    // Private mode / storage disabled — degrade to in-memory.
    return null;
  }
}

function makeSnapshot(
  entries: Map<string, QueueEntry>,
  inFlight: Set<string>
): GateEntrySnapshot {
  return {
    pendingCount: entries.size,
    syncing: inFlight.size > 0,
  };
}

export class GateEntryQueue {
  private readonly write: GateEntryQueueOptions['write'];
  private readonly storage: GateEntryStorage | null;
  private readonly storageKey: string;
  private readonly concurrency: number;
  private readonly baseDelayMs: number;
  private readonly maxDelayMs: number;
  private readonly now: () => number;
  private readonly random: () => number;
  private readonly isPermanentError: (error: unknown) => boolean;
  private readonly onChange?: (snapshot: GateEntrySnapshot) => void;
  private onSettled?: (id: string, value: GateEntryValue) => void;
  private onPermanentError?: (
    id: string,
    value: GateEntryValue,
    error: unknown
  ) => void;

  private readonly entries = new Map<string, QueueEntry>();
  private readonly inFlight = new Set<string>();
  private readonly listeners = new Set<() => void>();

  private snapshot: GateEntrySnapshot = { pendingCount: 0, syncing: false };
  private flushPromise: Promise<void> | null = null;
  private kickQueued = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private disposed = false;

  constructor(options: GateEntryQueueOptions) {
    this.write = options.write;
    this.storage =
      options.storage === undefined ? resolveDefaultStorage() : options.storage;
    this.storageKey = options.storageKey ?? DEFAULT_STORAGE_KEY;
    this.concurrency = Math.max(1, options.concurrency ?? DEFAULT_CONCURRENCY);
    this.baseDelayMs = Math.max(0, options.baseDelayMs ?? DEFAULT_BASE_DELAY_MS);
    this.maxDelayMs = Math.max(this.baseDelayMs, options.maxDelayMs ?? DEFAULT_MAX_DELAY_MS);
    this.now = options.now ?? Date.now;
    this.random = options.random ?? Math.random;
    this.isPermanentError = options.isPermanentError ?? defaultIsPermanentError;
    this.onChange = options.onChange;
    this.onSettled = options.onSettled;
    this.onPermanentError = options.onPermanentError;

    this.hydrate();
    this.emit();
  }

  /** Stable subscribe function suitable for `useSyncExternalStore`. */
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  /** Stable snapshot getter (returns the cached object, so React stays quiet). */
  getSnapshot = (): GateEntrySnapshot => this.snapshot;

  /** True when this vendor still has an unsynced mark. */
  has = (id: string): boolean => this.entries.has(id) || this.inFlight.has(id);

  /**
   * Swap the settlement callbacks without recreating the queue (which would
   * drop in-flight marks). Called from an effect so React state updates land
   * outside render.
   */
  configure(callbacks: {
    onSettled?: (id: string, value: GateEntryValue) => void;
    onPermanentError?: (id: string, value: GateEntryValue, error: unknown) => void;
  }): void {
    this.onSettled = callbacks.onSettled;
    this.onPermanentError = callbacks.onPermanentError;
  }

  /**
   * Record the absolute desired check-in value for a vendor.
   * Same-tick calls coalesce to the last value before anything is written.
   */
  set(id: string, value: GateEntryValue): void {
    if (this.disposed) return;
    const existing = this.entries.get(id);
    if (existing && existing.value === value) return;

    this.entries.set(id, {
      id,
      value,
      attempts: 0,
      nextAttemptAt: this.now(),
    });
    this.persist();
    this.emit();
    this.kick();
  }

  /** Retry right now, ignoring any backoff. Used on `online` / tab focus. */
  async retryNow(): Promise<void> {
    if (this.disposed) return;
    const now = this.now();
    for (const entry of this.entries.values()) {
      entry.nextAttemptAt = now;
    }
    this.persist();
    await this.flush();
  }

  /** Drain everything currently due. Safe to call repeatedly. */
  flush(): Promise<void> {
    if (this.disposed) return Promise.resolve();
    if (this.flushPromise) return this.flushPromise;

    this.flushPromise = this.drain()
      .catch(() => {
        // Individual failures are handled per-entry; never reject the caller.
      })
      .finally(() => {
        this.flushPromise = null;
        this.emit();
        this.scheduleNext();
      });

    return this.flushPromise;
  }

  dispose(): void {
    this.disposed = true;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.listeners.clear();
  }

  private kick(): void {
    if (this.kickQueued || this.disposed) return;
    this.kickQueued = true;
    // Microtask so two taps in the same interaction coalesce into one write.
    queueMicrotask(() => {
      this.kickQueued = false;
      void this.flush();
    });
  }

  private async drain(): Promise<void> {
    while (!this.disposed) {
      const now = this.now();
      const due: QueueEntry[] = [];
      for (const entry of this.entries.values()) {
        if (!this.inFlight.has(entry.id) && entry.nextAttemptAt <= now) {
          due.push(entry);
        }
      }
      if (due.length === 0) return;

      const batch = due.slice(0, this.concurrency);
      await Promise.all(batch.map((entry) => this.run(entry)));
    }
  }

  private async run(entry: QueueEntry): Promise<void> {
    this.inFlight.add(entry.id);
    this.emit();

    try {
      await this.write(entry.id, entry.value);
      const latest = this.entries.get(entry.id);

      if (!latest) return; // Cleared elsewhere.
      if (latest.value !== entry.value) {
        // A newer tap superseded this write; let the loop send the new value.
        return;
      }

      this.entries.delete(entry.id);
      this.persist();
      this.onSettled?.(entry.id, entry.value);
    } catch (error) {
      const latest = this.entries.get(entry.id);

      // Superseded writes fail harmlessly — the newer value is what matters.
      if (!latest || latest.value !== entry.value) return;

      if (this.isPermanentError(error)) {
        this.entries.delete(entry.id);
        this.persist();
        this.onPermanentError?.(entry.id, entry.value, error);
        return;
      }

      latest.attempts += 1;
      const exponential = Math.min(
        this.maxDelayMs,
        this.baseDelayMs * 2 ** Math.min(latest.attempts - 1, 10)
      );
      const jitter = Math.floor(this.random() * MAX_JITTER_MS);
      latest.nextAttemptAt = this.now() + exponential + jitter;
      this.persist();
    } finally {
      this.inFlight.delete(entry.id);
      this.emit();
    }
  }

  private scheduleNext(): void {
    if (this.disposed) return;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.entries.size === 0) return;

    let earliest = Number.POSITIVE_INFINITY;
    for (const entry of this.entries.values()) {
      if (entry.nextAttemptAt < earliest) earliest = entry.nextAttemptAt;
    }
    if (!Number.isFinite(earliest)) return;

    const delay = Math.max(0, earliest - this.now());
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.flush();
    }, delay);
  }

  private hydrate(): void {
    if (!this.storage) return;
    try {
      const raw = this.storage.getItem(this.storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as PersistedQueue;
      if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.entries)) return;

      for (const entry of parsed.entries) {
        if (
          entry &&
          typeof entry.id === 'string' &&
          entry.id.length > 0 &&
          (entry.value === null || typeof entry.value === 'string')
        ) {
          this.entries.set(entry.id, {
            id: entry.id,
            value: entry.value,
            attempts: Number.isFinite(entry.attempts) ? Math.max(0, entry.attempts) : 0,
            nextAttemptAt: Number.isFinite(entry.nextAttemptAt)
              ? entry.nextAttemptAt
              : this.now(),
          });
        }
      }
    } catch {
      // Corrupt cache should never block marking.
    }
  }

  private persist(): void {
    if (!this.storage) return;
    try {
      if (this.entries.size === 0) {
        if (this.storage.removeItem) {
          this.storage.removeItem(this.storageKey);
        } else {
          this.storage.setItem(this.storageKey, JSON.stringify({ version: 1, entries: [] }));
        }
        return;
      }
      const payload: PersistedQueue = {
        version: 1,
        entries: Array.from(this.entries.values()),
      };
      this.storage.setItem(this.storageKey, JSON.stringify(payload));
    } catch {
      // Quota / private mode — the in-memory queue still works for this tab.
    }
  }

  private emit(): void {
    const next = makeSnapshot(this.entries, this.inFlight);
    if (
      next.pendingCount === this.snapshot.pendingCount &&
      next.syncing === this.snapshot.syncing
    ) {
      return;
    }
    this.snapshot = next;
    this.onChange?.(next);
    for (const listener of this.listeners) listener();
  }
}

export { defaultIsPermanentError };
