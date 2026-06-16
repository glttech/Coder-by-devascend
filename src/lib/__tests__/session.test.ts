import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { getAuthMode, isAuthEnabled, getSessionOptions } from '../session.js';

// Helper to cast partial env objects for test use
function env(obj: Record<string, string> = {}): NodeJS.ProcessEnv {
  return obj as NodeJS.ProcessEnv;
}

describe('getAuthMode', () => {
  test('returns disabled when neither var is set', () => {
    assert.equal(getAuthMode(env()), 'disabled');
  });

  test('returns disabled when both are empty strings', () => {
    assert.equal(getAuthMode(env({ ADMIN_USERNAME: '', ADMIN_PASSWORD_HASH: '' })), 'disabled');
  });

  test('returns enforced when both vars are set', () => {
    assert.equal(
      getAuthMode(env({ ADMIN_USERNAME: 'admin', ADMIN_PASSWORD_HASH: '$2b$12$abc' })),
      'enforced',
    );
  });

  test('returns misconfigured when only ADMIN_USERNAME is set', () => {
    assert.equal(getAuthMode(env({ ADMIN_USERNAME: 'admin' })), 'misconfigured');
  });

  test('returns misconfigured when only ADMIN_PASSWORD_HASH is set', () => {
    assert.equal(getAuthMode(env({ ADMIN_PASSWORD_HASH: '$2b$12$abc' })), 'misconfigured');
  });
});

describe('isAuthEnabled', () => {
  test('returns false when auth is disabled', () => {
    assert.equal(isAuthEnabled(env()), false);
  });

  test('returns true when both vars are set', () => {
    assert.equal(
      isAuthEnabled(env({ ADMIN_USERNAME: 'admin', ADMIN_PASSWORD_HASH: '$2b$12$abc' })),
      true,
    );
  });
});

describe('getSessionOptions', () => {
  test('returns cookie name __session', () => {
    const opts = getSessionOptions(env());
    assert.equal(opts.cookieName, '__session');
  });

  test('uses placeholder password when auth is disabled', () => {
    const opts = getSessionOptions(env());
    assert.equal(typeof opts.password, 'string');
    assert.ok((opts.password as string).length >= 32);
  });

  test('uses SESSION_SECRET when auth is enforced', () => {
    const secret = 'a-very-long-secret-value-used-for-testing-only-1234';
    const opts = getSessionOptions(env({
      ADMIN_USERNAME: 'admin',
      ADMIN_PASSWORD_HASH: '$2b$12$abc',
      SESSION_SECRET: secret,
    }));
    assert.equal(opts.password, secret);
  });

  test('throws when auth is enforced but SESSION_SECRET is missing', () => {
    assert.throws(
      () => getSessionOptions(env({ ADMIN_USERNAME: 'admin', ADMIN_PASSWORD_HASH: '$2b$12$abc' })),
      /SESSION_SECRET must be set/,
    );
  });

  test('defaults TTL to 24 hours (86400 seconds)', () => {
    const opts = getSessionOptions(env());
    assert.equal(opts.ttl, 86400);
  });

  test('respects SESSION_MAX_AGE_HOURS override', () => {
    const opts = getSessionOptions(env({ SESSION_MAX_AGE_HOURS: '8' }));
    assert.equal(opts.ttl, 8 * 3600);
  });

  test('falls back to 24h if SESSION_MAX_AGE_HOURS is not a number', () => {
    const opts = getSessionOptions(env({ SESSION_MAX_AGE_HOURS: 'bad' }));
    assert.equal(opts.ttl, 86400);
  });

  test('httpOnly cookie option is true', () => {
    const opts = getSessionOptions(env());
    assert.equal(opts.cookieOptions?.httpOnly, true);
  });
});
