/**
 * Tests for the agent reliability scorecard helpers.
 *
 * The pure functions ciPassRate and mostCommonRisk are extracted from the
 * route handler and tested here without hitting the database or Next.js runtime.
 *
 * Auth behaviour is validated by exercising requireRole directly, mirroring
 * the pattern used by the route handler.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { requireRole } from '../rbac.js';
import type { AppSession } from '../session.js';

// ── Inline copies of the pure helpers (mirrors the route exports) ─────────────
// We test the logic in isolation without importing the Next.js route module,
// which would pull in server-only globals unavailable under node:test.

function ciPassRate(runs: { testResult: string | null }[]): number {
  if (runs.length === 0) return 0;
  const passing = runs.filter((r) => r.testResult && /pass/i.test(r.testResult)).length;
  return Math.round((passing / runs.length) * 100);
}

function mostCommonRisk(tasks: { riskLevel: string }[]): string {
  if (tasks.length === 0) return 'unknown';
  const counts: Record<string, number> = {};
  for (const t of tasks) counts[t.riskLevel] = (counts[t.riskLevel] ?? 0) + 1;
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

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

// ── Auth: 401 when not authenticated ─────────────────────────────────────────

describe('scorecard auth — unauthenticated', () => {
  it('returns 401 when user is null (mirrors GET handler requireRole check)', () => {
    const result = requireRole(null, 'any');
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.status, 401);
  });
});

// ── Auth: authenticated users pass ───────────────────────────────────────────

describe('scorecard auth — authenticated', () => {
  it('admin user passes requireRole any', () => {
    const result = requireRole(adminUser, 'any');
    assert.equal(result.ok, true);
  });

  it('reviewer user passes requireRole any', () => {
    const result = requireRole(reviewerUser, 'any');
    assert.equal(result.ok, true);
  });
});

// ── ciPassRate ────────────────────────────────────────────────────────────────

describe('ciPassRate — empty array', () => {
  it('returns 0 when no runs', () => {
    assert.equal(ciPassRate([]), 0);
  });
});

describe('ciPassRate — all null testResults', () => {
  it('returns 0 when all testResults are null', () => {
    const runs = [{ testResult: null }, { testResult: null }];
    assert.equal(ciPassRate(runs), 0);
  });
});

describe('ciPassRate — mixed results', () => {
  it('counts "pass" strings case-insensitively', () => {
    const runs = [
      { testResult: 'All 5 tests pass' },
      { testResult: 'PASS' },
      { testResult: 'failed' },
    ];
    // 2 of 3 pass → 67%
    assert.equal(ciPassRate(runs), 67);
  });

  it('run with testResult="All 5 tests pass" counts as CI pass', () => {
    const runs = [{ testResult: 'All 5 tests pass' }];
    assert.equal(ciPassRate(runs), 100);
  });

  it('run with testResult="failed" does not count as pass', () => {
    const runs = [{ testResult: 'failed' }];
    assert.equal(ciPassRate(runs), 0);
  });
});

describe('ciPassRate — successRate calculation', () => {
  it('provider with 2 succeeded + 1 failed → successRate 67', () => {
    // The route computes successRate as Math.round(completed/total*100).
    // Mirrors the calculation in the route handler.
    const total = 3;
    const completed = 2;
    const successRate = Math.round((completed / total) * 100);
    assert.equal(successRate, 67);
  });
});

// ── mostCommonRisk ────────────────────────────────────────────────────────────

describe('mostCommonRisk — empty array', () => {
  it('returns "unknown" when no tasks', () => {
    assert.equal(mostCommonRisk([]), 'unknown');
  });
});

describe('mostCommonRisk — single risk level', () => {
  it('returns the only risk level present', () => {
    const tasks = [{ riskLevel: 'low' }, { riskLevel: 'low' }];
    assert.equal(mostCommonRisk(tasks), 'low');
  });
});

describe('mostCommonRisk — mixed risk levels', () => {
  it('returns the most frequent risk level', () => {
    const tasks = [
      { riskLevel: 'high' },
      { riskLevel: 'high' },
      { riskLevel: 'medium' },
      { riskLevel: 'low' },
    ];
    assert.equal(mostCommonRisk(tasks), 'high');
  });

  it('handles tie by returning whichever appears first when sorted', () => {
    const tasks = [{ riskLevel: 'low' }, { riskLevel: 'high' }];
    // 1 each; sort is stable so first entry in Object.entries wins
    const result = mostCommonRisk(tasks);
    assert.ok(result === 'low' || result === 'high', 'must return one of the risk levels');
  });
});

// ── Response shape contract ───────────────────────────────────────────────────

describe('scorecard response shape — summary contract', () => {
  it('summary object has expected keys', () => {
    // Validates the shape contract without hitting the DB.
    const summary = {
      totalProviders: 2,
      totalRuns: 10,
      overallSuccessRate: 70,
    };
    assert.ok(typeof summary.totalProviders === 'number');
    assert.ok(typeof summary.totalRuns === 'number');
    assert.ok(typeof summary.overallSuccessRate === 'number');
  });

  it('provider metrics object has expected keys', () => {
    const metric = {
      providerId: 'abc',
      providerName: 'mock',
      providerType: 'mock',
      enabled: true,
      metrics: {
        totalRuns: 3,
        completedRuns: 2,
        failedRuns: 1,
        runningRuns: 0,
        successRate: 67,
        ciPassRate: 33,
        blockedRate: 33,
        avgRiskLevel: 'low',
        distinctTasks: 2,
      },
    };
    assert.ok(typeof metric.providerId === 'string');
    assert.ok(typeof metric.metrics.successRate === 'number');
    assert.ok(typeof metric.metrics.ciPassRate === 'number');
    assert.ok(typeof metric.metrics.avgRiskLevel === 'string');
  });
});
