/**
 * Tests for mutation endpoint rate limiting via checkLimit + getClientIp utilities.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { checkLimit, getClientIp, Bucket, MUTATION_LIMIT, WINDOW_MS } from '../rateLimiter';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeStore() {
  return new Map<string, Bucket>();
}

// ── getClientIp ───────────────────────────────────────────────────────────────

describe('getClientIp', () => {
  it('uses x-forwarded-for first', () => {
    assert.equal(getClientIp('1.2.3.4, 5.6.7.8', '9.10.11.12'), '1.2.3.4');
  });

  it('trims whitespace from x-forwarded-for', () => {
    assert.equal(getClientIp('  10.0.0.1  , 10.0.0.2', null), '10.0.0.1');
  });

  it('falls back to x-real-ip when forwarded-for absent', () => {
    assert.equal(getClientIp(null, '203.0.113.5'), '203.0.113.5');
  });

  it('returns "local" when both headers absent', () => {
    assert.equal(getClientIp(null, null), 'local');
  });
});

// ── checkLimit — basic allowing ───────────────────────────────────────────────

describe('checkLimit — basic', () => {
  it('allows first request', () => {
    const store = makeStore();
    const r = checkLimit(store, '1.2.3.4', 20, 0);
    assert.equal(r.ok, true);
    assert.equal(r.retryAfter, 0);
  });

  it('allows up to the limit', () => {
    const store = makeStore();
    for (let i = 0; i < 20; i++) {
      const r = checkLimit(store, 'ip', 20, 0);
      assert.equal(r.ok, true, `expected ok on request ${i + 1}`);
    }
  });

  it('blocks on the (limit+1)th request', () => {
    const store = makeStore();
    for (let i = 0; i < 20; i++) checkLimit(store, 'ip', 20, 0);
    const r = checkLimit(store, 'ip', 20, 0);
    assert.equal(r.ok, false);
    assert.ok(r.retryAfter > 0);
  });
});

// ── checkLimit — window expiry ────────────────────────────────────────────────

describe('checkLimit — window expiry', () => {
  it('resets after the window expires', () => {
    const store = makeStore();
    for (let i = 0; i < 20; i++) checkLimit(store, 'ip', 20, 0);

    // After WINDOW_MS, the bucket resets
    const r = checkLimit(store, 'ip', 20, WINDOW_MS + 1);
    assert.equal(r.ok, true, 'should allow after window expires');
  });

  it('does not reset within the window', () => {
    const store = makeStore();
    for (let i = 0; i < 20; i++) checkLimit(store, 'ip', 20, 0);
    const r = checkLimit(store, 'ip', 20, WINDOW_MS - 1);
    assert.equal(r.ok, false, 'should remain blocked within window');
  });
});

// ── checkLimit — per-IP isolation ─────────────────────────────────────────────

describe('checkLimit — per-IP isolation', () => {
  it('tracks different IPs independently', () => {
    const store = makeStore();
    // Exhaust IP A
    for (let i = 0; i < 20; i++) checkLimit(store, 'ip-a', 20, 0);
    assert.equal(checkLimit(store, 'ip-a', 20, 0).ok, false);

    // IP B is unaffected
    assert.equal(checkLimit(store, 'ip-b', 20, 0).ok, true);
  });
});

// ── retryAfter field ──────────────────────────────────────────────────────────

describe('checkLimit — retryAfter', () => {
  it('returns positive retryAfter when blocked', () => {
    const store = makeStore();
    for (let i = 0; i < 5; i++) checkLimit(store, 'ip', 5, 0);
    const r = checkLimit(store, 'ip', 5, 1000);
    assert.equal(r.ok, false);
    assert.ok(r.retryAfter > 0, `retryAfter should be positive, got ${r.retryAfter}`);
    assert.ok(r.retryAfter <= Math.ceil(WINDOW_MS / 1000), 'retryAfter should not exceed window duration');
  });
});

// ── sync endpoint limit (5/min) ───────────────────────────────────────────────

describe('sync endpoint rate limit (5/min)', () => {
  it('allows 5 sync requests and blocks the 6th', () => {
    const store = makeStore();
    for (let i = 0; i < 5; i++) {
      const r = checkLimit(store, 'admin-ip', 5, 0);
      assert.equal(r.ok, true, `sync request ${i + 1} should be allowed`);
    }
    const r = checkLimit(store, 'admin-ip', 5, 0);
    assert.equal(r.ok, false, '6th sync request should be blocked');
  });
});

// ── orchestrate endpoint limit (10/min) ──────────────────────────────────────

describe('orchestrate endpoint rate limit (10/min)', () => {
  it('allows 10 orchestrate requests and blocks the 11th', () => {
    const store = makeStore();
    for (let i = 0; i < 10; i++) {
      const r = checkLimit(store, 'user-ip', 10, 0);
      assert.equal(r.ok, true);
    }
    assert.equal(checkLimit(store, 'user-ip', 10, 0).ok, false);
  });
});

// ── MUTATION_LIMIT constant ───────────────────────────────────────────────────

describe('MUTATION_LIMIT constant', () => {
  it('MUTATION_LIMIT is 20', () => {
    assert.equal(MUTATION_LIMIT, 20);
  });

  it('WINDOW_MS is 60 seconds', () => {
    assert.equal(WINDOW_MS, 60_000);
  });
});
