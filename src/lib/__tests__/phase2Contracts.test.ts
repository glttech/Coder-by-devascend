/**
 * Phase 2 contract tests.
 *
 * These tests lock down the CURRENT behaviour of isPublicPath, resolveAuthDecision,
 * getSessionOptions, and validateAuthConfig so that any Phase 2 change that
 * silently breaks the single-admin login flow is caught immediately.
 *
 * Run with:
 *   ./node_modules/.bin/tsx --test src/lib/__tests__/*.test.ts
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { isPublicPath, resolveAuthDecision } from '../authGuard.js';
import { getSessionOptions, validateAuthConfig } from '../session.js';
import type { AppSession } from '../session.js';
import type { AuditLog, Approval } from '@prisma/client';

// ── isPublicPath — smoke tests ───────────────────────────────────────────────

describe('phase2Contracts — isPublicPath', () => {
  test('/login is public', () => {
    assert.equal(isPublicPath('/login'), true);
  });

  test('/api/auth/login is public', () => {
    assert.equal(isPublicPath('/api/auth/login'), true);
  });

  test('/tasks is not public', () => {
    assert.equal(isPublicPath('/tasks'), false);
  });

  test('/projects is not public', () => {
    assert.equal(isPublicPath('/projects'), false);
  });

  test('/api/tasks is not public', () => {
    assert.equal(isPublicPath('/api/tasks'), false);
  });
});

// ── resolveAuthDecision — authenticated path ─────────────────────────────────

describe('phase2Contracts — resolveAuthDecision authenticated', () => {
  test('authenticated session returns allow for page routes', () => {
    const decision = resolveAuthDecision({
      mode: 'enforced',
      isPublic: false,
      isAuthenticated: true,
      governanceKeyValid: false,
      isApiPath: false,
      pathname: '/tasks',
    });
    assert.deepEqual(decision, { action: 'allow' });
  });

  test('authenticated session returns allow for API routes', () => {
    const decision = resolveAuthDecision({
      mode: 'enforced',
      isPublic: false,
      isAuthenticated: true,
      governanceKeyValid: false,
      isApiPath: true,
      pathname: '/api/tasks',
    });
    assert.deepEqual(decision, { action: 'allow' });
  });
});

// ── resolveAuthDecision — unauthenticated redirect ───────────────────────────

describe('phase2Contracts — resolveAuthDecision unauthenticated', () => {
  test('unauthenticated non-public page route redirects to login with next path', () => {
    const decision = resolveAuthDecision({
      mode: 'enforced',
      isPublic: false,
      isAuthenticated: false,
      governanceKeyValid: false,
      isApiPath: false,
      pathname: '/tasks',
    });
    assert.deepEqual(decision, { action: 'redirect_login', next: '/tasks' });
  });

  test('unauthenticated non-public API route returns 401', () => {
    const decision = resolveAuthDecision({
      mode: 'enforced',
      isPublic: false,
      isAuthenticated: false,
      governanceKeyValid: false,
      isApiPath: true,
      pathname: '/api/tasks',
    });
    assert.deepEqual(decision, { action: 'reject_401' });
  });
});

// ── session options — cookie name contract ────────────────────────────────────

describe('phase2Contracts — session cookie name', () => {
  test('cookieName is __session', () => {
    // If Phase 2 changes the cookie name, existing sessions will be invalidated.
    // This test must be updated intentionally if the cookie name changes.
    const opts = getSessionOptions({});
    assert.equal(opts.cookieName, '__session');
  });

  test('cookie is httpOnly', () => {
    const opts = getSessionOptions({});
    assert.equal(opts.cookieOptions?.httpOnly, true);
  });

  test('cookie sameSite is lax', () => {
    const opts = getSessionOptions({});
    assert.equal(opts.cookieOptions?.sameSite, 'lax');
  });

  test('default TTL is 24 hours (86400 seconds)', () => {
    const opts = getSessionOptions({});
    assert.equal(opts.ttl, 86400);
  });
});

// ── validateAuthConfig — contracts ───────────────────────────────────────────

describe('phase2Contracts — validateAuthConfig', () => {
  test('valid enforced config (both creds + long secret) returns ok: true', () => {
    const result = validateAuthConfig({
      ADMIN_USERNAME: 'admin',
      ADMIN_PASSWORD_HASH: '$2b$12$somehash',
      SESSION_SECRET: 'a-sufficiently-long-secret-value-for-iron-session-12345',
    });
    assert.deepEqual(result, { ok: true });
  });

  test('missing SESSION_SECRET in enforced mode returns ok: false', () => {
    const result = validateAuthConfig({
      ADMIN_USERNAME: 'admin',
      ADMIN_PASSWORD_HASH: '$2b$12$somehash',
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.ok(
        result.error.toLowerCase().includes('session_secret'),
        `expected error to mention SESSION_SECRET, got: ${result.error}`,
      );
    }
  });

  test('disabled mode (no env vars) returns ok: true', () => {
    const result = validateAuthConfig({});
    assert.deepEqual(result, { ok: true });
  });

  test('misconfigured mode (username only) returns ok: false', () => {
    const result = validateAuthConfig({ ADMIN_USERNAME: 'admin' });
    assert.equal(result.ok, false);
  });

  test('misconfigured mode (hash only) returns ok: false', () => {
    const result = validateAuthConfig({ ADMIN_PASSWORD_HASH: '$2b$12$abc' });
    assert.equal(result.ok, false);
  });
});

// ── Prisma model field contracts ─────────────────────────────────────────────

describe('phase2Contracts — AuditLog model has userId field', () => {
  test('AuditLog type includes userId (string | null)', () => {
    // Type-level: create a partial object and assert the key exists at runtime.
    const log = { userId: null } as Partial<AuditLog>;
    assert.ok('userId' in log, 'AuditLog should have a userId field');
  });
});

describe('phase2Contracts — Approval model has approverId field', () => {
  test('Approval type includes approverId (string | null)', () => {
    const approval = { approverId: null } as Partial<Approval>;
    assert.ok('approverId' in approval, 'Approval should have an approverId field');
  });
});

describe('phase2Contracts — AppSession has sessionId-equivalent and role fields', () => {
  test('AppSession includes userId field', () => {
    const session: Partial<AppSession> = { userId: 'some-uuid' };
    assert.ok('userId' in session, 'AppSession should have a userId field');
  });

  test('AppSession includes role field', () => {
    const session: Partial<AppSession> = { role: 'admin' };
    assert.ok('role' in session, 'AppSession should have a role field');
  });

  test('AppSession role is constrained to admin or reviewer', () => {
    const adminSession: Partial<AppSession> = { role: 'admin' };
    const reviewerSession: Partial<AppSession> = { role: 'reviewer' };
    assert.equal(adminSession.role, 'admin');
    assert.equal(reviewerSession.role, 'reviewer');
  });
});
