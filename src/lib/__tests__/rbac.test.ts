import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { requireRole, canApprove, canViewTasks } from '../rbac.js';
import type { AppSession } from '../session.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

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

// ── requireRole ───────────────────────────────────────────────────────────────

describe('requireRole — null user', () => {
  test('returns 401 for any role when user is null', () => {
    const result = requireRole(null, 'any');
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.status, 401);
  });

  test('returns 401 for admin role when user is null', () => {
    const result = requireRole(null, 'admin');
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.status, 401);
  });

  test('returns 401 for reviewer role when user is null', () => {
    const result = requireRole(null, 'reviewer');
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.status, 401);
  });
});

describe('requireRole — admin required', () => {
  test('reviewer user gets 403 when admin is required', () => {
    const result = requireRole(reviewerUser, 'admin');
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.status, 403);
  });

  test('admin user is allowed when admin is required', () => {
    const result = requireRole(adminUser, 'admin');
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.user.userId, adminUser.userId);
  });
});

describe('requireRole — reviewer required', () => {
  test('reviewer user is allowed when reviewer is required', () => {
    const result = requireRole(reviewerUser, 'reviewer');
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.user.userId, reviewerUser.userId);
  });

  test('admin user is allowed when reviewer is required', () => {
    const result = requireRole(adminUser, 'reviewer');
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.user.userId, adminUser.userId);
  });
});

describe('requireRole — any role', () => {
  test('reviewer is allowed with role any', () => {
    const result = requireRole(reviewerUser, 'any');
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.user.userId, reviewerUser.userId);
  });

  test('admin is allowed with role any', () => {
    const result = requireRole(adminUser, 'any');
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.user.userId, adminUser.userId);
  });
});

// ── canApprove ────────────────────────────────────────────────────────────────

describe('canApprove', () => {
  test('null user → false', () => assert.equal(canApprove(null), false));
  test('reviewer → false', () => assert.equal(canApprove(reviewerUser), false));
  test('admin → true', () => assert.equal(canApprove(adminUser), true));
});

// ── canViewTasks ──────────────────────────────────────────────────────────────

describe('canViewTasks', () => {
  test('null → false', () => assert.equal(canViewTasks(null), false));
  test('reviewer → true', () => assert.equal(canViewTasks(reviewerUser), true));
  test('admin → true', () => assert.equal(canViewTasks(adminUser), true));
});
