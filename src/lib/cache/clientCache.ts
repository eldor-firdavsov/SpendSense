'use client';

/**
 * SpendSense AI — Client-side In-Memory Cache and SWR Engine
 * 
 * Provides:
 * 1. Instant (0ms) data retrieval on page revisit or tab navigation.
 * 2. Stale-While-Revalidate (SWR): renders stale cache immediately while refreshing silently in background.
 * 3. Request deduplication: eliminates duplicate simultaneous network calls.
 * 4. User isolation: prevents data leaking across different accounts; automatically wipes on logout.
 * 5. Targeted cache invalidation after mutations (transactions, budgets, goals).
 */

interface CacheEntry<T = unknown> {
  data: T;
  timestamp: number;
  ttl: number;
  userId?: string | null;
}

const memoryCache = new Map<string, CacheEntry>();
const inFlightRequests = new Map<string, Promise<unknown>>();
let currentActiveUserId: string | null = null;

// Default TTLs in milliseconds
export const CACHE_TTL = {
  CATEGORIES: 5 * 60 * 1000, // 5 minutes
  TRANSACTIONS: 60 * 1000,    // 1 minute fresh
  ANALYTICS: 60 * 1000,       // 1 minute fresh
  BUDGETS: 60 * 1000,         // 1 minute fresh
  GOALS: 60 * 1000,           // 1 minute fresh
} as const;

// Allow stale data to be returned instantly for up to 15 minutes while background revalidation occurs
const STALE_GRACE_PERIOD_MS = 15 * 60 * 1000;

/**
 * Sets the active authenticated user ID.
 * If user switches or logs out, isolates or purges cache entries.
 */
export function setCacheUser(userId: string | null): void {
  if (currentActiveUserId !== userId) {
    // User changed or logged out — wipe caches immediately
    clearAllCache();
    currentActiveUserId = userId;
  }
}

/**
 * Synchronous cache lookup.
 * Returns cached data immediately if available (even if stale), enabling 0ms component initialization.
 */
export function peekCache<T = unknown>(url: string): T | undefined {
  const cached = memoryCache.get(url);
  if (!cached) return undefined;

  // Verify user isolation
  if (currentActiveUserId && cached.userId && cached.userId !== currentActiveUserId) {
    memoryCache.delete(url);
    return undefined;
  }

  const age = Date.now() - cached.timestamp;
  if (age < cached.ttl + STALE_GRACE_PERIOD_MS) {
    return cached.data as T;
  }

  return undefined;
}

/**
 * Fetch with memory caching, Stale-While-Revalidate (SWR), and deduplication.
 */
export async function cachedFetch<T = unknown>(
  url: string,
  options?: RequestInit,
  ttlMs = 60000
): Promise<T> {
  const method = (options?.method || 'GET').toUpperCase();

  // Non-GET requests are not cached
  if (method !== 'GET') {
    const res = await fetch(url, options);
    if (!res.ok) {
      let errJson: Record<string, unknown> | null = null;
      try {
        errJson = (await res.json()) as Record<string, unknown>;
      } catch {
        errJson = { error: `HTTP ${res.status}` };
      }
      const message =
        (typeof errJson?.error === 'string' && errJson.error) ||
        (typeof errJson?.message === 'string' && errJson.message) ||
        `Request failed with status ${res.status}`;
      const error = Object.assign(new Error(message), { status: res.status });
      throw error;
    }
    return res.json() as Promise<T>;
  }

  const now = Date.now();
  const cached = memoryCache.get(url);

  // Check if cache entry belongs to active user
  const isValidUser = !currentActiveUserId || !cached?.userId || cached.userId === currentActiveUserId;

  if (cached && isValidUser) {
    const age = now - cached.timestamp;

    // 1. FRESH CACHE: return immediately
    if (age < cached.ttl) {
      return cached.data as T;
    }

    // 2. STALE CACHE (SWR): return stale data immediately and trigger background revalidation
    if (age < cached.ttl + STALE_GRACE_PERIOD_MS) {
      // Trigger background revalidate if not already in-flight
      if (!inFlightRequests.has(url)) {
        triggerBackgroundRevalidate(url, options, ttlMs);
      }
      return cached.data as T;
    }
  }

  // 3. NO CACHE OR EXPIRED: deduplicate and fetch over network
  const existingPromise = inFlightRequests.get(url);
  if (existingPromise) {
    return existingPromise as Promise<T>;
  }

  const fetchPromise = executeNetworkFetch<T>(url, options, ttlMs);
  inFlightRequests.set(url, fetchPromise);
  return fetchPromise;
}

/**
 * Executes a network fetch and populates memory cache.
 */
async function executeNetworkFetch<T>(
  url: string,
  options?: RequestInit,
  ttlMs = 60000
): Promise<T> {
  try {
    const res = await fetch(url, options);
    if (!res.ok) {
      let errJson: Record<string, unknown> | null = null;
      try {
        errJson = (await res.json()) as Record<string, unknown>;
      } catch {
        errJson = { error: `HTTP ${res.status}` };
      }
      const message =
        (typeof errJson?.error === 'string' && errJson.error) ||
        (typeof errJson?.message === 'string' && errJson.message) ||
        `Request failed with status ${res.status}`;
      const error = Object.assign(new Error(message), { status: res.status, data: errJson });
      throw error;
    }

    const data = await res.json();
    memoryCache.set(url, {
      data,
      timestamp: Date.now(),
      ttl: ttlMs,
      userId: currentActiveUserId,
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('spendsense:cache-updated', { detail: { url, data } }));
    }

    return data as T;
  } finally {
    inFlightRequests.delete(url);
  }
}

/**
 * Background silent revalidation without throwing to caller.
 */
function triggerBackgroundRevalidate(
  url: string,
  options?: RequestInit,
  ttlMs = 60000
): void {
  const promise = executeNetworkFetch(url, options, ttlMs)
    .catch((err) => {
      // Background revalidation error is silently captured to prevent breaking active view
      console.warn(`[SWR background revalidate warning for ${url}]:`, err?.message || err);
    });
  inFlightRequests.set(url, promise);
}

/**
 * Pre-warm cache for a URL ahead of time (e.g. on navigation link hover/focus/touch).
 */
export async function warmCache(url: string, ttlMs?: number): Promise<void> {
  try {
    const cached = peekCache(url);
    if (cached) return; // Already cached
    await cachedFetch(url, undefined, ttlMs);
  } catch {
    // Ignore prefetch errors silently
  }
}

/**
 * Invalidate cached entries matching a URL prefix.
 * Example: invalidateCache('/api/transactions') clears all transaction queries and filters.
 */
export function invalidateCache(urlPrefix?: string): void {
  if (!urlPrefix) {
    clearAllCache();
    return;
  }

  for (const key of memoryCache.keys()) {
    if (key.startsWith(urlPrefix)) {
      memoryCache.delete(key);
    }
  }

  // Broadcast event for active views to re-fetch if needed
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('spendsense:cache-invalidated', { detail: { urlPrefix } }));
  }
}

/**
 * Completely wipe all in-memory caches and in-flight requests.
 * Used on user logout, account switch, or full refresh.
 */
export function clearAllCache(): void {
  memoryCache.clear();
  inFlightRequests.clear();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('spendsense:cache-cleared'));
  }
}

/**
 * Helper to invalidate all financial caches on mutation (add/edit/delete)
 */
export function invalidateAllFinancialCaches(): void {
  invalidateCache('/api/transactions');
  invalidateCache('/api/analytics');
  invalidateCache('/api/budgets');
  invalidateCache('/api/goals');
}
