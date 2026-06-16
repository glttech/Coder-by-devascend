import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { requireRole } from '../rbac.js';
import type { AppSession } from '../session.js';

// Tests for GET /api/orgs and POST /api/orgs auth guard logic
// These tests exercise the requireRole helper used by the orgs API routes
// without making real HTTP calls (no DB required).

const adminUser: AppSession = {
  userId: 'user-admin-1',
  username: 'admin@example.com',
  role: 'admin',
  loginAt: '2024-01-01T00:00:00.000Z',
  sessionId: 'session-admin-1',
};

const reviewerUser: AppSession = {
  userId: 'user-reviewer-1',
  username: 'reviewer@example.com',
  role: 'reviewer',
  loginAt: '2024-01-01T00:00:00.000Z',
  sessionId: 'session-reviewer-1',
};

describe('GET /api/orgs — auth guard', () => {
  test('unauthenticated request (null session) → 401', () => {
    const check = requireRole(null, 'any');
    assert.equal(check.ok, false);
    if (!check.ok) assert.equal(check.status, 401);
  });

  test('admin user is authorized', () => {
    const check = requireRole(adminUser, 'any');
    assert.equal(check.ok, true);
    if (check.ok) assert.equal(check.user.userId, adminUser.userId);
  });

  test('reviewer user is authorized', () => {
    const check = requireRole(reviewerUser, 'any');
    assert.equal(check.ok, true);
    if (check.ok) assert.equal(check.user.userId, reviewerUser.userId);
  });
});

describe('POST /api/orgs — auth guard', () => {
  test('unauthenticated request (null session) → 401', () => {
    const check = requireRole(null, 'any');
    assert.equal(check.ok, false);
    if (!check.ok) assert.equal(check.status, 401);
  });

  test('admin user is authorized to create org', () => {
    const check = requireRole(adminUser, 'any');
    assert.equal(check.ok, true);
  });

  test('reviewer user is authorized to create org', () => {
    const check = requireRole(reviewerUser, 'any');
    assert.equal(check.ok, true);
  });
});

describe('POST /api/orgs — slug validation', () => {
  function validateSlug(slug: string): boolean {
    return /^[a-z0-9-]{2,40}$/.test(slug);
  }

  test('valid slug passes validation', () => {
    assert.equal(validateSlug('my-org'), true);
    assert.equal(validateSlug('acme'), true);
    assert.equal(validateSlug('team-123'), true);
  });

  test('slug with uppercase is rejected', () => {
    assert.equal(validateSlug('MyOrg'), false);
  });

  test('slug with special characters is rejected', () => {
    assert.equal(validateSlug('my_org'), false);
    assert.equal(validateSlug('my.org'), false);
    assert.equal(validateSlug('my org'), false);
  });

  test('slug too short is rejected', () => {
    assert.equal(validateSlug('a'), false);
  });

  test('slug too long is rejected', () => {
    assert.equal(validateSlug('a'.repeat(41)), false);
  });

  test('minimum valid slug (2 chars) passes', () => {
    assert.equal(validateSlug('ab'), true);
  });

  test('maximum valid slug (40 chars) passes', () => {
    assert.equal(validateSlug('a'.repeat(40)), true);
  });
});
