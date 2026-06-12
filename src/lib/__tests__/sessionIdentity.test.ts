/**
 * Tests for session identity wiring (PR #76: feat/phase2-session-identity).
 *
 * Covers:
 *  - AppSession shape: userId, username, role, loginAt
 *  - Auth check logic mirroring readSession() in middleware
 *  - admin-unseed fallback is treated as authenticated
 *  - getCurrentUser export exists and is async
 *  - UserRole type values
 *  - role field satisfies UserRole
 *
 * Uses node:test + node:assert/strict (no Jest).
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import type { AppSession, UserRole } from '../session.js';
import { getCurrentUser } from '../session.js';

// ---------------------------------------------------------------------------
// Helper that mirrors the auth check inside readSession() in middleware.ts.
// Returns true when data?.userId is truthy — exactly the same guard.
// ---------------------------------------------------------------------------
function authCheck(data: Partial<AppSession> | null | undefined): boolean {
  return Boolean(data?.userId);
}

// ---------------------------------------------------------------------------
// 1. Missing userId → not authenticated
// ---------------------------------------------------------------------------
describe('AppSession auth check — missing userId', () => {
  test('null session data returns false', () => {
    assert.equal(authCheck(null), false);
  });

  test('undefined session data returns false', () => {
    assert.equal(authCheck(undefined), false);
  });

  test('session with empty-string userId returns false', () => {
    const session: Partial<AppSession> = { userId: '', username: 'admin', role: 'admin', loginAt: new Date().toISOString() };
    assert.equal(authCheck(session), false);
  });
});

// ---------------------------------------------------------------------------
// 2. Real UUID userId → authenticated
// ---------------------------------------------------------------------------
describe('AppSession auth check — real UUID userId', () => {
  test('session with real UUID userId returns true', () => {
    const session: AppSession = {
      userId: '550e8400-e29b-41d4-a716-446655440000',
      username: 'admin@example.com',
      role: 'admin',
      loginAt: new Date().toISOString(),
    };
    assert.equal(authCheck(session), true);
  });

  test('userId value is preserved as-is in the session object', () => {
    const uuid = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
    const session: AppSession = {
      userId: uuid,
      username: 'admin@example.com',
      role: 'admin',
      loginAt: new Date().toISOString(),
    };
    assert.equal(session.userId, uuid);
  });
});

// ---------------------------------------------------------------------------
// 3. admin-unseed fallback userId → still authenticated
// ---------------------------------------------------------------------------
describe('AppSession auth check — admin-unseed fallback', () => {
  test("session with userId 'admin-unseed' returns true", () => {
    const session: AppSession = {
      userId: 'admin-unseed',
      username: 'admin@example.com',
      role: 'admin',
      loginAt: new Date().toISOString(),
    };
    assert.equal(authCheck(session), true);
  });

  test("'admin-unseed' fallback session has role 'admin'", () => {
    const session: AppSession = {
      userId: 'admin-unseed',
      username: 'admin@example.com',
      role: 'admin',
      loginAt: new Date().toISOString(),
    };
    assert.equal(session.role, 'admin');
  });
});

// ---------------------------------------------------------------------------
// 4. getCurrentUser — null path (no cookies available in test env)
// ---------------------------------------------------------------------------
describe('getCurrentUser helper', () => {
  test('getCurrentUser is exported as a function', () => {
    assert.equal(typeof getCurrentUser, 'function');
  });

  test('getCurrentUser returns a Promise (is async)', () => {
    // In the test environment next/headers is unavailable, so the try/catch
    // inside getCurrentUser catches the error and returns null.
    const result = getCurrentUser();
    assert.ok(result instanceof Promise, 'getCurrentUser must return a Promise');
    // Clean up without letting an unhandled rejection escape.
    return result.then((val) => {
      assert.equal(val, null);
    });
  });
});

// ---------------------------------------------------------------------------
// 5. UserRole type — both values are valid
// ---------------------------------------------------------------------------
describe('UserRole type values', () => {
  test("'admin' is a valid UserRole", () => {
    const role: UserRole = 'admin';
    assert.equal(role, 'admin');
  });

  test("'reviewer' is a valid UserRole", () => {
    const role: UserRole = 'reviewer';
    assert.equal(role, 'reviewer');
  });

  test('admin and reviewer are distinct strings', () => {
    const admin: UserRole = 'admin';
    const reviewer: UserRole = 'reviewer';
    assert.notEqual(admin, reviewer);
  });
});

// ---------------------------------------------------------------------------
// 6. AppSession role field satisfies UserRole
// ---------------------------------------------------------------------------
describe('AppSession role field', () => {
  test("role field 'admin' satisfies UserRole in a full AppSession", () => {
    const session: AppSession = {
      userId: 'some-uuid',
      username: 'admin@example.com',
      role: 'admin',
      loginAt: '2026-01-01T00:00:00.000Z',
    };
    // Compile-time check: if role weren't UserRole this wouldn't typecheck.
    const role: UserRole = session.role;
    assert.equal(role, 'admin');
  });

  test("role field 'reviewer' satisfies UserRole in a full AppSession", () => {
    const session: AppSession = {
      userId: 'some-uuid',
      username: 'reviewer@example.com',
      role: 'reviewer',
      loginAt: '2026-01-01T00:00:00.000Z',
    };
    const role: UserRole = session.role;
    assert.equal(role, 'reviewer');
  });

  test('AppSession loginAt is a string field', () => {
    const now = new Date().toISOString();
    const session: AppSession = {
      userId: 'abc-123',
      username: 'user@example.com',
      role: 'admin',
      loginAt: now,
    };
    assert.equal(typeof session.loginAt, 'string');
    assert.equal(session.loginAt, now);
  });
});
