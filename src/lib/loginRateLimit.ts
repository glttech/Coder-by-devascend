const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

interface Bucket {
  count: number;
  windowStart: number;
}

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  allowed: boolean;
  remainingAttempts: number;
  retryAfterMs: number;
}

export function checkLoginRateLimit(ip: string, nowMs: number = Date.now()): RateLimitResult {
  const bucket = buckets.get(ip);

  if (!bucket || nowMs - bucket.windowStart >= WINDOW_MS) {
    buckets.set(ip, { count: 1, windowStart: nowMs });
    return { allowed: true, remainingAttempts: MAX_ATTEMPTS - 1, retryAfterMs: 0 };
  }

  if (bucket.count >= MAX_ATTEMPTS) {
    const retryAfterMs = WINDOW_MS - (nowMs - bucket.windowStart);
    return { allowed: false, remainingAttempts: 0, retryAfterMs };
  }

  bucket.count += 1;
  return { allowed: true, remainingAttempts: MAX_ATTEMPTS - bucket.count, retryAfterMs: 0 };
}

export function resetLoginRateLimit(ip: string): void {
  buckets.delete(ip);
}
