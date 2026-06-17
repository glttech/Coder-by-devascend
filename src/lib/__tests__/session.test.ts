import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  getAuthMode, isAuthEnabled, getSessionOptions,
  validateAuthConfig, parseSessionMaxAge, SESSION_SECRET_MIN_LENGTH,
} from '../session.js';

describe('getAuthMode', () => {
  test('returns disabled when neither var is set', () => {
    assert.equal(getAuthMode({}), 'disabled');
  });

  test('returns disabled when both are empty strings', () => {
    assert.equal(getAuthMode({ ADMIN_USERNAME: '', ADMIN_PASSWORD_HASH: '' }), 'disabled');
  });

  test('returns enforced when both vars are set', () => {
    assert.equal(
      getAuthMode({ ADMIN_USERNAME: 'admin', ADMIN_PASSWORD_HASH: '$2b$12$abc' }),
      'enforced',
    );
  });

  test('returns misconfigured when only ADMIN_USERNAME is set', () => {
    assert.equal(getAuthMode({ ADMIN_USERNAME: 'admin' }), 'misconfigured');
  });

  test('returns misconfigured when only ADMIN_PASSWORD_HASH is set', () => {
    assert.equal(getAuthMode({ ADMIN_PASSWORD_HASH: '$2b$12$abc' }), 'misconfigured');
  });
});

describe('isAuthEnabled', () => {
  test('returns false when auth is disabled', () => {
    assert.equal(isAuthEnabled({}), false);
  });

  test('returns true when both vars are set', () => {
    assert.equal(
      isAuthEnabled({ ADMIN_USERNAME: 'admin', ADMIN_PASSWORD_HASH: '$2b$12$abc' }),
      true,
    );
  });
});

describe('getSessionOptions', () => {
  test('returns cookie name __session', () => {
    const opts = getSessionOptions({});
    assert.equal(opts.cookieName, '__session');
  });

  test('uses placeholder password when auth is disabled', () => {
    const opts = getSessionOptions({});
    assert.equal(typeof opts.password, 'string');
    assert.ok((opts.password as string).length >= 32);
  });

  test('uses SESSION_SECRET when auth is enforced', () => {
    const secret = 'a-very-long-secret-value-used-for-testing-only-1234';
    const opts = getSessionOptions({
      ADMIN_USERNAME: 'admin',
      ADMIN_PASSWORD_HASH: '$2b$12$abc',
      SESSION_SECRET: secret,
    });
    assert.equal(opts.password, secret);
  });

  test('throws when auth is enforced but SESSION_SECRET is missing', () => {
    assert.throws(
      () => getSessionOptions({ ADMIN_USERNAME: 'admin', ADMIN_PASSWORD_HASH: '$2b$12$abc' }),
      /SESSION_SECRET must be set/,
    );
  });

  test('defaults TTL to 24 hours (86400 seconds)', () => {
    const opts = getSessionOptions({});
    assert.equal(opts.ttl, 86400);
  });

  test('respects SESSION_MAX_AGE_HOURS override', () => {
    const opts = getSessionOptions({ SESSION_MAX_AGE_HOURS: '8' });
    assert.equal(opts.ttl, 8 * 3600);
  });

  test('falls back to 24h if SESSION_MAX_AGE_HOURS is not a number', () => {
    const opts = getSessionOptions({ SESSION_MAX_AGE_HOURS: 'bad' });
    assert.equal(opts.ttl, 86400);
  });

  test('httpOnly cookie option is true', () => {
    const opts = getSessionOptions({});
    assert.equal(opts.cookieOptions?.httpOnly, true);
  });
});

// ── validateAuthConfig ─────────────────────────────────────────────────────

describe('validateAuthConfig — disabled mode', () => {
  test('empty env is valid (disabled mode)', () => {
    assert.deepEqual(validateAuthConfig({}), { ok: true });
  });
});

describe('validateAuthConfig — misconfigured mode', () => {
  test('username without hash reports missing hash', () => {
    const r = validateAuthConfig({ ADMIN_USERNAME: 'admin' });
    assert.equal(r.ok, false);
    if (!r.ok) assert.ok(r.error.includes('ADMIN_PASSWORD_HASH'));
  });

  test('hash without username reports missing username', () => {
    const r = validateAuthConfig({ ADMIN_PASSWORD_HASH: '$2b$12$abc' });
    assert.equal(r.ok, false);
    if (!r.ok) assert.ok(r.error.includes('ADMIN_USERNAME'));
  });

  test('error message does not contain secret values', () => {
    const r = validateAuthConfig({ ADMIN_USERNAME: 'mys3cr3tname' });
    assert.equal(r.ok, false);
    if (!r.ok) assert.ok(!r.error.includes('mys3cr3tname'));
  });
});

describe('validateAuthConfig — enforced mode', () => {
  const bothSet = { ADMIN_USERNAME: 'admin', ADMIN_PASSWORD_HASH: '$2b$12$abc' };

  test('enforced without SESSION_SECRET is invalid', () => {
    const r = validateAuthConfig(bothSet);
    assert.equal(r.ok, false);
    if (!r.ok) assert.ok(r.error.includes('SESSION_SECRET'));
  });

  test('enforced with short SESSION_SECRET is invalid', () => {
    const r = validateAuthConfig({ ...bothSet, SESSION_SECRET: 'short' });
    assert.equal(r.ok, false);
    if (!r.ok) assert.ok(r.error.includes(`${SESSION_SECRET_MIN_LENGTH}`));
  });

  test('enforced with adequate SESSION_SECRET is valid', () => {
    const secret = 'a'.repeat(SESSION_SECRET_MIN_LENGTH);
    const r = validateAuthConfig({ ...bothSet, SESSION_SECRET: secret });
    assert.deepEqual(r, { ok: true });
  });

  test('error never exposes SESSION_SECRET value', () => {
    const r = validateAuthConfig({ ...bothSet, SESSION_SECRET: 'tooshort' });
    assert.equal(r.ok, false);
    if (!r.ok) assert.ok(!r.error.includes('tooshort'));
  });
});

// ── parseSessionMaxAge ─────────────────────────────────────────────────────

describe('parseSessionMaxAge', () => {
  test('undefined returns 24h with no warning', () => {
    assert.deepEqual(parseSessionMaxAge(undefined), { hours: 24 });
  });

  test('valid positive integer is parsed', () => {
    assert.deepEqual(parseSessionMaxAge('8'), { hours: 8 });
  });

  test('non-numeric string returns 24h with warning', () => {
    const r = parseSessionMaxAge('bad');
    assert.equal(r.hours, 24);
    assert.ok(typeof r.warning === 'string' && r.warning.length > 0);
  });

  test('zero returns 24h with warning', () => {
    const r = parseSessionMaxAge('0');
    assert.equal(r.hours, 24);
    assert.ok(r.warning);
  });

  test('negative returns 24h with warning', () => {
    const r = parseSessionMaxAge('-5');
    assert.equal(r.hours, 24);
    assert.ok(r.warning);
  });

  test('warning does not contain the raw invalid value', () => {
    const r = parseSessionMaxAge('mys3cr3tval');
    assert.ok(r.warning);
    // Warning should describe the problem generically, not echo back the value
    assert.ok(!r.warning!.includes('mys3cr3tval'));
  });
});

// ── getSessionOptions — secret length enforcement ──────────────────────────

describe('getSessionOptions — secret length validation', () => {
  const bothSet = { ADMIN_USERNAME: 'admin', ADMIN_PASSWORD_HASH: '$2b$12$abc' };

  test('throws when SESSION_SECRET is shorter than minimum', () => {
    assert.throws(
      () => getSessionOptions({ ...bothSet, SESSION_SECRET: 'tooshort' }),
      /at least 32/,
    );
  });

  test('accepts SESSION_SECRET exactly at minimum length', () => {
    const secret = 'x'.repeat(SESSION_SECRET_MIN_LENGTH);
    const opts = getSessionOptions({ ...bothSet, SESSION_SECRET: secret });
    assert.equal(opts.password, secret);
  });
});
