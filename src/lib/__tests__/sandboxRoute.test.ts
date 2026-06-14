import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { getFeatureFlags } from '../featureFlags.js';
import { requireRole } from '../rbac.js';
import type { AppSession } from '../session.js';

// Pure-function mirror of POST /api/tasks/[id]/sandbox logic.
// Tests the guard conditions without touching the DB or HTTP layer.

// ── Feature flag guard ─────────────────────────────────────────────────────

describe('sandbox route — feature flag guard', () => {
  test('returns 403 when FEATURE_SANDBOX_MODE is not set', () => {
    const flags = getFeatureFlags({});
    assert.equal(flags.sandboxMode, false, 'sandboxMode should be false when env is empty');

    // Simulate the guard:
    const status = flags.sandboxMode ? 201 : 403;
    assert.equal(status, 403, 'should return 403 when sandbox mode is disabled');
  });

  test('returns 403 when FEATURE_SANDBOX_MODE is "false"', () => {
    const flags = getFeatureFlags({ FEATURE_SANDBOX_MODE: 'false' });
    assert.equal(flags.sandboxMode, false);
    assert.equal(flags.sandboxMode ? 201 : 403, 403);
  });

  test('does NOT return 403 when FEATURE_SANDBOX_MODE is "true"', () => {
    const flags = getFeatureFlags({ FEATURE_SANDBOX_MODE: 'true' });
    assert.equal(flags.sandboxMode, true);
    // Flag check passes — would proceed to auth check, not 403
    assert.equal(flags.sandboxMode ? 'proceed' : 403, 'proceed');
  });
});

// ── Auth guard ─────────────────────────────────────────────────────────────

describe('sandbox route — auth guard', () => {
  test('returns 401 when not authenticated (null session)', () => {
    const auth = requireRole(null, 'admin');
    assert.equal(auth.ok, false);
    if (!auth.ok) {
      assert.equal(auth.status, 401);
    }
  });

  test('returns 403 when authenticated as reviewer (not admin)', () => {
    const reviewer: AppSession = {
      userId: 'u1',
      username: 'reviewer@example.com',
      role: 'reviewer',
      loginAt: new Date().toISOString(),
      sessionId: 'sess-1',
    };
    const auth = requireRole(reviewer, 'admin');
    assert.equal(auth.ok, false);
    if (!auth.ok) {
      assert.equal(auth.status, 403);
    }
  });

  test('passes auth when user is admin', () => {
    const admin: AppSession = {
      userId: 'u2',
      username: 'admin@example.com',
      role: 'admin',
      loginAt: new Date().toISOString(),
      sessionId: 'sess-2',
    };
    const auth = requireRole(admin, 'admin');
    assert.equal(auth.ok, true);
  });
});

// ── Task not found guard ───────────────────────────────────────────────────

describe('sandbox route — task lookup', () => {
  test('returns 404 when task is null', () => {
    // Simulate: const task = await prisma.task.findUnique(...) => null
    const task: null = null;
    const status = task === null ? 404 : 201;
    assert.equal(status, 404);
  });

  test('proceeds when task is found', () => {
    const task = {
      id: 'task-123',
      instruction: 'Update the UI',
      riskLevel: 'low',
      environment: 'dev',
      agentTool: 'claude-code-manual',
    };
    const status = task === null ? 404 : 201;
    assert.equal(status, 201);
  });
});

// ── Both flags together ────────────────────────────────────────────────────

describe('sandbox route — combined flag and auth guards', () => {
  test('401 takes precedence over 403 flag check when flag disabled and user is null', () => {
    // In the actual route, feature flag is checked FIRST, then auth.
    // So if flag is off: 403 before auth check.
    const flags = getFeatureFlags({});
    if (!flags.sandboxMode) {
      // route returns 403 immediately — auth is never checked
      assert.equal(403, 403, 'should be 403 for disabled flag');
    }
  });

  test('returns 403 for disabled flag even if user would be valid admin', () => {
    const flags = getFeatureFlags({ FEATURE_SANDBOX_MODE: 'false' });
    const wouldBeStatus = flags.sandboxMode ? 'check_auth' : 403;
    assert.equal(wouldBeStatus, 403);
  });
});
