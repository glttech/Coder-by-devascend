import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  checkLimit,
  getClientIp,
  isMutationMethod,
  MUTATION_LIMIT,
  READ_LIMIT,
  WINDOW_MS,
  type Bucket,
} from '../rateLimiter.js';

// ── checkLimit — basic allow/block ─────────────────────────────────────────

describe('checkLimit — allows requests within limit', () => {
  test('first request is always allowed', () => {
    const store = new Map<string, Bucket>();
    const { ok } = checkLimit(store, 'ip:m', MUTATION_LIMIT, 1000);
    assert.equal(ok, true);
  });

  test('second request within limit is allowed', () => {
    const store = new Map<string, Bucket>();
    checkLimit(store, 'ip:m', MUTATION_LIMIT, 1000);
    const { ok } = checkLimit(store, 'ip:m', MUTATION_LIMIT, 1001);
    assert.equal(ok, true);
  });

  test(`${MUTATION_LIMIT}th POST request (at limit) is allowed`, () => {
    const store = new Map<string, Bucket>();
    for (let i = 0; i < MUTATION_LIMIT - 1; i++) {
      checkLimit(store, 'ip:m', MUTATION_LIMIT, 1000 + i);
    }
    const { ok } = checkLimit(store, 'ip:m', MUTATION_LIMIT, 1000 + MUTATION_LIMIT - 1);
    assert.equal(ok, true);
  });

  test(`${MUTATION_LIMIT + 1}th POST request (over limit) is blocked`, () => {
    const store = new Map<string, Bucket>();
    for (let i = 0; i < MUTATION_LIMIT; i++) {
      checkLimit(store, 'ip:m', MUTATION_LIMIT, 1000);
    }
    const { ok } = checkLimit(store, 'ip:m', MUTATION_LIMIT, 1000);
    assert.equal(ok, false);
  });

  test(`${READ_LIMIT}th GET request (at limit) is allowed`, () => {
    const store = new Map<string, Bucket>();
    for (let i = 0; i < READ_LIMIT - 1; i++) {
      checkLimit(store, 'ip:r', READ_LIMIT, 1000);
    }
    const { ok } = checkLimit(store, 'ip:r', READ_LIMIT, 1000);
    assert.equal(ok, true);
  });

  test(`${READ_LIMIT + 1}th GET request is blocked`, () => {
    const store = new Map<string, Bucket>();
    for (let i = 0; i < READ_LIMIT; i++) {
      checkLimit(store, 'ip:r', READ_LIMIT, 1000);
    }
    const { ok } = checkLimit(store, 'ip:r', READ_LIMIT, 1000);
    assert.equal(ok, false);
  });

  test('GET limit (60) is higher than POST limit (20)', () => {
    assert.ok(READ_LIMIT > MUTATION_LIMIT, `READ_LIMIT ${READ_LIMIT} must exceed MUTATION_LIMIT ${MUTATION_LIMIT}`);
  });
});

// ── checkLimit — retryAfter ────────────────────────────────────────────────

describe('checkLimit — retryAfter value', () => {
  test('retryAfter is 0 when request is allowed', () => {
    const store = new Map<string, Bucket>();
    const { retryAfter } = checkLimit(store, 'ip:m', MUTATION_LIMIT, 1000);
    assert.equal(retryAfter, 0);
  });

  test('retryAfter is positive seconds when blocked', () => {
    const store = new Map<string, Bucket>();
    const start = 1_000_000;
    for (let i = 0; i < MUTATION_LIMIT; i++) checkLimit(store, 'ip:m', MUTATION_LIMIT, start);
    const { ok, retryAfter } = checkLimit(store, 'ip:m', MUTATION_LIMIT, start);
    assert.equal(ok, false);
    assert.ok(retryAfter > 0, 'retryAfter must be positive when blocked');
    assert.ok(retryAfter <= 60, 'retryAfter must not exceed window size (60s)');
  });

  test('retryAfter decreases as time progresses within the window', () => {
    const store = new Map<string, Bucket>();
    const start = 1_000_000;
    for (let i = 0; i < MUTATION_LIMIT; i++) checkLimit(store, 'ip:m', MUTATION_LIMIT, start);

    const { retryAfter: ra1 } = checkLimit(store, 'ip:m', MUTATION_LIMIT, start + 10_000); // 10s in
    const { retryAfter: ra2 } = checkLimit(store, 'ip:m', MUTATION_LIMIT, start + 20_000); // 20s in
    assert.ok(ra1 > ra2, 'retryAfter should decrease as time passes');
  });
});

// ── checkLimit — window reset ──────────────────────────────────────────────

describe('checkLimit — window reset', () => {
  test('window resets after WINDOW_MS — requests allowed again', () => {
    const store = new Map<string, Bucket>();
    const start = 1_000_000;
    for (let i = 0; i < MUTATION_LIMIT; i++) checkLimit(store, 'ip:m', MUTATION_LIMIT, start);

    // Just before window expires: still blocked
    const { ok: stillBlocked } = checkLimit(store, 'ip:m', MUTATION_LIMIT, start + WINDOW_MS - 1);
    assert.equal(stillBlocked, false);

    // At or after window expiry: allowed again
    const { ok: allowed } = checkLimit(store, 'ip:m', MUTATION_LIMIT, start + WINDOW_MS);
    assert.equal(allowed, true);
  });

  test('count resets to 1 after window expires', () => {
    const store = new Map<string, Bucket>();
    const start = 1_000_000;
    for (let i = 0; i < MUTATION_LIMIT; i++) checkLimit(store, 'ip:m', MUTATION_LIMIT, start);

    // New window — first request resets count to 1
    checkLimit(store, 'ip:m', MUTATION_LIMIT, start + WINDOW_MS);
    const bucket = store.get('ip:m')!;
    assert.equal(bucket.count, 1);
    assert.ok(bucket.reset > start + WINDOW_MS, 'reset timestamp advances to next window');
  });
});

// ── checkLimit — key isolation ─────────────────────────────────────────────

describe('checkLimit — key isolation', () => {
  test('different IPs have independent buckets', () => {
    const store = new Map<string, Bucket>();
    for (let i = 0; i < MUTATION_LIMIT; i++) checkLimit(store, 'ip1:m', MUTATION_LIMIT, 1000);

    // ip1 is blocked
    assert.equal(checkLimit(store, 'ip1:m', MUTATION_LIMIT, 1000).ok, false);
    // ip2 is unaffected
    assert.equal(checkLimit(store, 'ip2:m', MUTATION_LIMIT, 1000).ok, true);
  });

  test('mutation bucket and read bucket are independent per IP', () => {
    const store = new Map<string, Bucket>();
    for (let i = 0; i < MUTATION_LIMIT; i++) checkLimit(store, 'ip:m', MUTATION_LIMIT, 1000);

    // Mutation bucket exhausted
    assert.equal(checkLimit(store, 'ip:m', MUTATION_LIMIT, 1000).ok, false);
    // Read bucket unaffected
    assert.equal(checkLimit(store, 'ip:r', READ_LIMIT, 1000).ok, true);
  });
});

// ── getClientIp ────────────────────────────────────────────────────────────

describe('getClientIp', () => {
  test('uses x-forwarded-for when present', () => {
    assert.equal(getClientIp('1.2.3.4', null), '1.2.3.4');
  });

  test('takes first IP from comma-separated x-forwarded-for', () => {
    assert.equal(getClientIp('1.2.3.4, 5.6.7.8, 9.10.11.12', null), '1.2.3.4');
  });

  test('trims whitespace from x-forwarded-for', () => {
    assert.equal(getClientIp('  1.2.3.4  , 5.6.7.8', null), '1.2.3.4');
  });

  test('falls back to x-real-ip when x-forwarded-for is null', () => {
    assert.equal(getClientIp(null, '10.0.0.1'), '10.0.0.1');
  });

  test('trims whitespace from x-real-ip', () => {
    assert.equal(getClientIp(null, '  10.0.0.1  '), '10.0.0.1');
  });

  test('returns "local" when both headers are null', () => {
    assert.equal(getClientIp(null, null), 'local');
  });

  test('x-forwarded-for takes precedence over x-real-ip', () => {
    assert.equal(getClientIp('1.2.3.4', '9.9.9.9'), '1.2.3.4');
  });
});

// ── isMutationMethod ───────────────────────────────────────────────────────

describe('isMutationMethod', () => {
  test('POST is a mutation', () => assert.equal(isMutationMethod('POST'), true));
  test('PATCH is a mutation', () => assert.equal(isMutationMethod('PATCH'), true));
  test('post (lowercase) is a mutation', () => assert.equal(isMutationMethod('post'), true));
  test('patch (lowercase) is a mutation', () => assert.equal(isMutationMethod('patch'), true));
  test('GET is not a mutation', () => assert.equal(isMutationMethod('GET'), false));
  test('DELETE is not a mutation', () => assert.equal(isMutationMethod('DELETE'), false));
  test('PUT is not a mutation', () => assert.equal(isMutationMethod('PUT'), false));
  test('HEAD is not a mutation', () => assert.equal(isMutationMethod('HEAD'), false));
});
