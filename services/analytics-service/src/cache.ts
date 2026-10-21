// SPDX-License-Identifier: MIT
/**
 * Simple in-memory TTL cache for analytics query results.
 *
 * Caching is opt-in and configured via the `ANALYTICS_CACHE_TTL_SECONDS`
 * environment variable. A TTL of `0` (or unset) disables caching entirely so
 * callers always receive fresh data — useful for debugging or low-traffic
 * deployments where staleness is unacceptable.
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number; // epoch millis
}

export class AnalyticsCache {
  private store = new Map<string, CacheEntry<unknown>>();
  private ttlMs: number;

  /**
   * @param ttlSeconds Time-to-live for cached entries in seconds. `0` disables caching.
   */
  constructor(ttlSeconds: number) {
    this.ttlMs = Math.max(0, Math.floor(ttlSeconds)) * 1000;
  }

  /** Whether caching is enabled (TTL > 0). */
  get enabled(): boolean {
    return this.ttlMs > 0;
  }

  /** TTL in seconds (read-only view of the configured value). */
  get ttlSeconds(): number {
    return Math.floor(this.ttlMs / 1000);
  }

  private expired(entry: CacheEntry<unknown>, now: number): boolean {
    return now >= entry.expiresAt;
  }

  /** Returns the cached value for `key`, or `undefined` on miss / expiry. */
  get<T>(key: string): T | undefined {
    if (!this.enabled) return undefined;
    const now = Date.now();
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (this.expired(entry, now)) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value as T;
  }

  /** Stores `value` under `key` with the configured TTL. No-op when disabled. */
  set<T>(key: string, value: T): void {
    if (!this.enabled) return;
    this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }

  /**
   * Returns a cached value if present and fresh, otherwise calls `loader`,
   * stores the result, and returns it. When caching is disabled this is a
   * transparent pass-through to `loader`.
   */
  async getOrCompute<T>(key: string, loader: () => Promise<T>): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== undefined) return cached;
    const value = await loader();
    this.set(key, value);
    return value;
  }

  /** Removes all entries (e.g. on config reload). */
  clear(): void {
    this.store.clear();
  }

  /** Current number of cached entries (for diagnostics). */
  get size(): number {
    return this.store.size;
  }
}

/**
 * Parses the `ANALYTICS_CACHE_TTL_SECONDS` environment variable.
 * Defaults to 0 (disabled) when unset or invalid.
 */
export function cacheTtlFromEnv(): number {
  const raw = process.env.ANALYTICS_CACHE_TTL_SECONDS;
  if (!raw) return 0;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.floor(parsed);
}
