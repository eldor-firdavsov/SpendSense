'use client';

/**
 * SpendSense AI — Client-side In-Memory Cache and Request Deduplication
 * 
 * Provides:
 * 1. Instant (0ms) data retrieval on page revisit or tab navigation.
 * 2. Request deduplication: eliminates redundant simultaneous network calls.
 * 3. Safe TTL & targeted invalidation: mutations immediately clear relevant keys.
 */

interface CacheEntry<T = unknown> {
  data: T;
  timestamp: number;
  ttl: number;
}

const memoryCache = new Map<string, CacheEntry>();
const inFlightRequests = new Map<string, Promise<unknown>>();

// Default TTLs in milliseconds
export const CACHE_TTL = {
  CATEGORIES: 5 * 60 * 1000, // 5 minutes (rarely change)
  TRANSACTIONS: 45 * 1000,    // 45 seconds
  ANALYTICS: 45 * 1000,       // 45 seconds
  BUDGETS: 45 * 1000,         // 45 seconds
  GOALS: 45 * 1000,           // 45 seconds
} as const;

/**
 * Fetch with memory caching and deduplication.
 */
export async function cachedFetch<T = unknown>(
  url: string,
  options?: RequestInit,
  ttlMs = 45000
): Promise<T> {
  const method = (options?.method || 'GET').toUpperCase();

  // Only GET requests are cached
  if (method !== 'GET') {
    return (await fetch(url, options)).json() as Promise<T>;
  }

  const now = Date.now();
  const cached = memoryCache.get(url);

  // Return cached entry if still fresh
  if (cached && now - cached.timestamp < cached.ttl) {
    return cached.data as T;
  }

  // Deduplicate in-flight requests for the exact same URL
  const existingPromise = inFlightRequests.get(url);
  if (existingPromise) {
    return existingPromise as Promise<T>;
  }

  const fetchPromise = (async () => {
    try {
      const res = await fetch(url, options);
      if (!res.ok) {
        let errJson: any;
        try {
          errJson = await res.json();
        } catch {
          errJson = { error: `HTTP ${res.status}` };
        }
        const error = new Error(errJson?.error || errJson?.message || `Request failed with status ${res.status}`);
        (error as any).status = res.status;
        (error as any).data = errJson;
        throw error;
      }

      const data = await res.json();
      memoryCache.set(url, {
        data,
        timestamp: Date.now(),
        ttl: ttlMs,
      });
      return data as T;
    } finally {
      inFlightRequests.delete(url);
    }
  })();

  inFlightRequests.set(url, fetchPromise);
  return fetchPromise;
}

/**
 * Invalidate cached entries matching a URL prefix.
 * Example: invalidateCache('/api/transactions') clears all transaction pages and filters.
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

  // Also broadcast event for active listeners
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('spendsense:cache-invalidated', { detail: { urlPrefix } }));
  }
}

/**
 * Completely wipe all in-memory caches and in-flight requests.
 * Used on user logout, account switch, or manual full refresh.
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
