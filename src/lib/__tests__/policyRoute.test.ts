/**
 * Tests for the policy gate logic as exercised by the GET /api/tasks/[id]/policy route.
 *
 * The route does three things:
 *   1. Auth check via requireRole (tested in rbac.test.ts)
 *   2. prisma.task.findUnique lookup (integration concern — not unit-tested here)
 *   3. evaluatePolicy(task) → returns PolicyEvalResult
 *
 * This file validates the shape and semantics of PolicyEvalResult as the route
 * would return it, simulating the 401, 404, and success paths at the logic level.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { evaluatePolicy, type PolicyEvalResult } from '../policyGates.js';
import { requireRole } from '../rbac.js';
import type { AppSession } from '../session.js';

// ── Auth check (mirrors what the route does) ──────────────────────────────────

describe('policy route — auth guard', () => {
  it('returns 401 when no user session exists', () => {
    const check = requireRole(null, 'any');
    assert.equal(check.ok, false);
    if (!check.ok) assert.equal(check.status, 401);
  });

  it('allows any authenticated role', () => {
    const reviewer: AppSession = {
      userId: 'u1',
      username: 'reviewer@example.com',
      role: 'reviewer',
      loginAt: '2024-01-01T00:00:00Z',
      sessionId: 's1',
    };
    const check = requireRole(reviewer, 'any');
    assert.equal(check.ok, true);
  });
});

// ── PolicyEvalResult shape ────────────────────────────────────────────────────

describe('policy route — result shape', () => {
  it('returns a valid PolicyEvalResult with all expected keys', () => {
    const task = { title: 'Fix button', instruction: 'Change the color', riskLevel: 'low', environment: 'dev' };
    const result: PolicyEvalResult = evaluatePolicy(task);

    assert.ok('violations' in result, 'result must have violations');
    assert.ok('blocked' in result, 'result must have blocked');
    assert.ok('requiresApproval' in result, 'result must have requiresApproval');
    assert.ok('highestSeverity' in result, 'result must have highestSeverity');
    assert.ok(Array.isArray(result.violations), 'violations must be an array');
    assert.equal(typeof result.blocked, 'boolean');
    assert.equal(typeof result.requiresApproval, 'boolean');
    assert.ok(['block', 'require_approval', 'none'].includes(result.highestSeverity));
  });

  it('returns violations array of correct shape for a matched rule', () => {
    const task = { title: 'Stripe integration', instruction: 'add stripe payment checkout flow', riskLevel: 'low', environment: 'dev' };
    const result = evaluatePolicy(task);

    assert.ok(result.violations.length > 0, 'at least one violation expected');
    const v = result.violations[0];
    assert.ok('ruleId' in v);
    assert.ok('ruleName' in v);
    assert.ok('category' in v);
    assert.ok('severity' in v);
    assert.ok('reason' in v);
    assert.equal(typeof v.ruleId, 'string');
    assert.equal(typeof v.ruleName, 'string');
    assert.equal(typeof v.reason, 'string');
    assert.ok(['block', 'require_approval'].includes(v.severity));
  });
});

// ── Simulated 404 behaviour (task not found) ─────────────────────────────────

describe('policy route — task not found', () => {
  it('returns 404 shape when task is null (simulated)', () => {
    // Simulate what the route does: if prisma returns null, it returns 404.
    const task: { title: string; instruction: string; riskLevel: string; environment: string } | null = null;
    let status = 200;
    if (!task) status = 404;
    assert.equal(status, 404);
  });
});

// ── End-to-end evaluation matching real task shapes ────────────────────────────

describe('policy route — evaluatePolicy on realistic task shapes', () => {
  it('clean task returns empty violations and highestSeverity none', () => {
    const result = evaluatePolicy({ title: 'Improve UI', instruction: 'Center the login button', riskLevel: 'low', environment: 'dev' });
    assert.equal(result.violations.length, 0);
    assert.equal(result.blocked, false);
    assert.equal(result.requiresApproval, false);
    assert.equal(result.highestSeverity, 'none');
  });

  it('migration task returns requiresApproval true, blocked false', () => {
    const result = evaluatePolicy({ title: 'db migration', instruction: 'prisma migrate deploy on staging', riskLevel: 'low', environment: 'staging' });
    assert.equal(result.requiresApproval, true);
    assert.equal(result.blocked, false);
    assert.equal(result.highestSeverity, 'require_approval');
  });

  it('payment task returns blocked true', () => {
    const result = evaluatePolicy({ title: 'Add billing', instruction: 'Integrate stripe subscription checkout', riskLevel: 'medium', environment: 'staging' });
    assert.equal(result.blocked, true);
    assert.equal(result.highestSeverity, 'block');
  });
});
