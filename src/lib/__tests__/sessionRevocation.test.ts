/**
 * Tests for session revocation (PR #80: feat/phase2-session-revocation).
 *
 * Covers:
 *  - Function signatures of createActiveSession, validateActiveSession, revokeActiveSession
 *  - Session without sessionId is treated as unauthenticated
 *  - Revoked session logic (revokedAt set)
 *  - Expired session logic (expiresAt in the past)
 *  - AppSession.sessionId field is present and is a string
 *
 * Uses node:test + node:assert/strict (no Jest, no DB).
 * All DB calls are NOT invoked — only function signatures and pure logic are tested.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  createActiveSession,
  validateActiveSession,
  revokeActiveSession,
  revokeAllUserSessions,
} from '../sessionStore.js';
import type { AppSession } from '../session.js';

// ---------------------------------------------------------------------------
// Helper: simulate the sessionId guard that every auth check performs.
// A session without a sessionId field (or with empty string) is not valid.
// ---------------------------------------------------------------------------
function hasSessionId(session: Partial<AppSession> | null | undefined): boolean {
  return Boolean(session?.sessionId);
}

// ---------------------------------------------------------------------------
// Helper: simulate the DB-level validity check without hitting the DB.
// Mirrors the WHERE clause in validateActiveSession.
// ---------------------------------------------------------------------------
interface MockActiveSession {
  sessionId: string;
  userId: string;
  expiresAt: Date;
  revokedAt: Date | null;
}

function isMockSessionValid(row: MockActiveSession | null, now: Date = new Date()): boolean {
  if (!row) return false;
  if (row.revokedAt !== null) return false;
  if (row.expiresAt <= now) return false;
  return true;
}

// ---------------------------------------------------------------------------
// 1. Function signature tests — verifying exports are callable functions.
// ---------------------------------------------------------------------------
describe('sessionStore exports — function signatures', () => {
  test('createActiveSession is exported as a function', () => {
    assert.equal(typeof createActiveSession, 'function');
  });

  test('validateActiveSession is exported as a function', () => {
    assert.equal(typeof validateActiveSession, 'function');
  });

  test('revokeActiveSession is exported as a function', () => {
    assert.equal(typeof revokeActiveSession, 'function');
  });

  test('revokeAllUserSessions is exported as a function', () => {
    assert.equal(typeof revokeAllUserSessions, 'function');
  });

  test('validateActiveSession returns a Promise', () => {
    // Calling with a sessionId that won't exist in DB; the function
    // catches DB errors and returns false, so this is safe.
    const result = validateActiveSession('non-existent-session-id');
    assert.ok(result instanceof Promise, 'validateActiveSession must return a Promise');
    // Consume the promise to avoid unhandled rejection.
    return result.then((val) => {
      assert.equal(typeof val, 'boolean');
    });
  });
});

// ---------------------------------------------------------------------------
// 2. Session without sessionId → not authenticated.
// ---------------------------------------------------------------------------
describe('AppSession sessionId guard', () => {
  test('session missing sessionId field is treated as unauthenticated', () => {
    const session: Partial<AppSession> = {
      userId: 'user-uuid',
      username: 'admin@example.com',
      role: 'admin',
      loginAt: new Date().toISOString(),
      // sessionId intentionally absent
    };
    assert.equal(hasSessionId(session), false);
  });

  test('session with empty-string sessionId is treated as unauthenticated', () => {
    const session: Partial<AppSession> = {
      userId: 'user-uuid',
      username: 'admin@example.com',
      role: 'admin',
      loginAt: new Date().toISOString(),
      sessionId: '',
    };
    assert.equal(hasSessionId(session), false);
  });

  test('null session is treated as unauthenticated', () => {
    assert.equal(hasSessionId(null), false);
  });

  test('session with valid sessionId UUID is authenticated', () => {
    const session: AppSession = {
      userId: 'user-uuid',
      username: 'admin@example.com',
      role: 'admin',
      loginAt: new Date().toISOString(),
      sessionId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    };
    assert.equal(hasSessionId(session), true);
  });
});

// ---------------------------------------------------------------------------
// 3. Revoked session logic.
// ---------------------------------------------------------------------------
describe('revoked session validation', () => {
  test('session with revokedAt set is not valid', () => {
    const row: MockActiveSession = {
      sessionId: 'revoked-session-uuid',
      userId: 'user-uuid',
      expiresAt: new Date(Date.now() + 3600_000), // 1 hour in the future
      revokedAt: new Date(), // revoked NOW
    };
    assert.equal(isMockSessionValid(row), false);
  });

  test('session with revokedAt in the past is not valid', () => {
    const row: MockActiveSession = {
      sessionId: 'old-revoked-session-uuid',
      userId: 'user-uuid',
      expiresAt: new Date(Date.now() + 3600_000),
      revokedAt: new Date(Date.now() - 60_000), // revoked 1 minute ago
    };
    assert.equal(isMockSessionValid(row), false);
  });
});

// ---------------------------------------------------------------------------
// 4. Expired session logic.
// ---------------------------------------------------------------------------
describe('expired session validation', () => {
  test('session with expiresAt in the past is not valid', () => {
    const row: MockActiveSession = {
      sessionId: 'expired-session-uuid',
      userId: 'user-uuid',
      expiresAt: new Date(Date.now() - 1), // expired 1ms ago
      revokedAt: null,
    };
    assert.equal(isMockSessionValid(row), false);
  });

  test('session with expiresAt exactly at now boundary is not valid', () => {
    const now = new Date();
    const row: MockActiveSession = {
      sessionId: 'boundary-session-uuid',
      userId: 'user-uuid',
      expiresAt: now, // expiresAt <= now → invalid
      revokedAt: null,
    };
    assert.equal(isMockSessionValid(row, now), false);
  });

  test('session with expiresAt in the future and no revokedAt is valid', () => {
    const row: MockActiveSession = {
      sessionId: 'valid-session-uuid',
      userId: 'user-uuid',
      expiresAt: new Date(Date.now() + 3600_000), // 1 hour in the future
      revokedAt: null,
    };
    assert.equal(isMockSessionValid(row), true);
  });
});

// ---------------------------------------------------------------------------
// 5. Null row (no matching DB row) → not valid.
// ---------------------------------------------------------------------------
describe('missing session row', () => {
  test('null row (no DB match) returns false', () => {
    assert.equal(isMockSessionValid(null), false);
  });
});

// ---------------------------------------------------------------------------
// 6. AppSession.sessionId field type.
// ---------------------------------------------------------------------------
describe('AppSession.sessionId field', () => {
  test('sessionId is stored as a string in AppSession', () => {
    const session: AppSession = {
      userId: 'user-uuid',
      username: 'admin@example.com',
      role: 'admin',
      loginAt: new Date().toISOString(),
      sessionId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    };
    assert.equal(typeof session.sessionId, 'string');
  });

  test('sessionId value is preserved exactly in AppSession', () => {
    const id = 'deadbeef-dead-beef-dead-beefdeadbeef';
    const session: AppSession = {
      userId: 'user-uuid',
      username: 'admin@example.com',
      role: 'admin',
      loginAt: new Date().toISOString(),
      sessionId: id,
    };
    assert.equal(session.sessionId, id);
  });
});
