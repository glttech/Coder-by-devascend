export const WINDOW_MS = 60_000; // 1 minute sliding window
export const MUTATION_LIMIT = 20; // POST / PATCH per minute per IP
export const READ_LIMIT = 60;     // GET per minute per IP

export interface Bucket {
  count: number;
  reset: number; // epoch ms when the current window expires
}

/**
 * Check whether a keyed bucket is within the rate limit.
 * @param store  Shared bucket map (module-level in middleware)
 * @param key    Unique key, e.g. "1.2.3.4:m" (IP + method class)
 * @param limit  Max requests allowed in WINDOW_MS
 * @param nowMs  Current timestamp — injectable for deterministic tests
 */
export function checkLimit(
  store: Map<string, Bucket>,
  key: string,
  limit: number,
  nowMs: number = Date.now(),
): { ok: boolean; retryAfter: number } {
  const b = store.get(key);

  if (!b || nowMs >= b.reset) {
    store.set(key, { count: 1, reset: nowMs + WINDOW_MS });
    return { ok: true, retryAfter: 0 };
  }

  if (b.count >= limit) {
    return { ok: false, retryAfter: Math.ceil((b.reset - nowMs) / 1000) };
  }

  b.count++;
  return { ok: true, retryAfter: 0 };
}

/**
 * Extract the best-available client IP from proxy/gateway headers.
 */
export function getClientIp(
  forwardedFor: string | null,
  realIp: string | null,
): string {
  if (forwardedFor) return forwardedFor.split(',')[0].trim();
  if (realIp) return realIp.trim();
  return 'local';
}

/** Returns true for methods that mutate state (POST, PATCH). */
export function isMutationMethod(method: string): boolean {
  const m = method.toUpperCase();
  return m === 'POST' || m === 'PATCH';
}
