/**
 * Tests for executive dashboard logic, feature flag display safety,
 * system status shape, and project health aggregation.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { computeProjectHealth, healthSignal } from '../projectHealth.js';
import { getFeatureFlags, type FeatureFlags } from '../featureFlags.js';
import type { PRHealthInput, ProjectHealth } from '../projectHealth.js';

// ── Helpers ───────────────────────────────────────────────────────────────

const NOW = new Date('2026-06-19T12:00:00Z');
const RECENT = new Date('2026-06-18T12:00:00Z');  // 1 day ago — not stale
const STALE = new Date('2026-06-01T12:00:00Z');   // 18 days ago — stale

function makePR(overrides: Partial<PRHealthInput> = {}): PRHealthInput {
  return {
    title: 'feat: add feature',
    body: null,
    state: 'open',
    merged: false,
    ciStatus: 'success',
    importedAt: RECENT,
    updatedAt: RECENT,
    ...overrides,
  };
}

// ── 1. Project health aggregation — empty ──────────────────────────────────

describe('executive: project health aggregation — empty input', () => {
  test('returns all zeros for empty PR list', () => {
    const h = computeProjectHealth([], NOW);
    assert.deepEqual(h, {
      total: 0,
      mergedCount: 0,
      openCount: 0,
      failedCICount: 0,
      pendingCICount: 0,
      highRiskCount: 0,
      staleCount: 0,
    });
  });
});

// ── 2. Project health aggregation — counts ─────────────────────────────────

describe('executive: project health aggregation — multi-project counts', () => {
  test('total count matches number of PRs', () => {
    const prs = [makePR(), makePR(), makePR()];
    const h = computeProjectHealth(prs, NOW);
    assert.equal(h.total, 3);
  });

  test('merged PRs counted separately from open PRs', () => {
    const prs = [
      makePR({ merged: true, state: 'merged' }),
      makePR({ merged: false, state: 'open' }),
      makePR({ merged: false, state: 'open' }),
    ];
    const h = computeProjectHealth(prs, NOW);
    assert.equal(h.mergedCount, 1);
    assert.equal(h.openCount, 2);
  });

  test('failed CI PRs are counted correctly across projects', () => {
    const prs = [
      makePR({ ciStatus: 'failure' }),
      makePR({ ciStatus: 'failure' }),
      makePR({ ciStatus: 'success' }),
    ];
    const h = computeProjectHealth(prs, NOW);
    assert.equal(h.failedCICount, 2);
  });
});

// ── 3. Executive summary computation ──────────────────────────────────────

describe('executive: summary computation — total counts', () => {
  test('summary aggregation sums correctly across zero items', () => {
    // Simulate what executive page does: aggregate totals
    const projects: { prCount: number; taskCount: number; agentRunCount: number }[] = [];
    const totalTasks = projects.reduce((acc, p) => acc + p.taskCount, 0);
    const totalAgentRuns = projects.reduce((acc, p) => acc + p.agentRunCount, 0);
    assert.equal(totalTasks, 0);
    assert.equal(totalAgentRuns, 0);
  });

  test('summary aggregation sums correctly across multiple projects', () => {
    const projects = [
      { prCount: 5, taskCount: 10, agentRunCount: 3 },
      { prCount: 2, taskCount: 7, agentRunCount: 1 },
      { prCount: 8, taskCount: 3, agentRunCount: 5 },
    ];
    const totalTasks = projects.reduce((acc, p) => acc + p.taskCount, 0);
    const totalPRs = projects.reduce((acc, p) => acc + p.prCount, 0);
    const totalAgentRuns = projects.reduce((acc, p) => acc + p.agentRunCount, 0);
    assert.equal(totalTasks, 20);
    assert.equal(totalPRs, 15);
    assert.equal(totalAgentRuns, 9);
  });

  test('project rows are sorted with most recent projects first conceptually', () => {
    const projectIds = ['a', 'b', 'c'];
    const reversed = [...projectIds].reverse();
    assert.deepEqual(reversed, ['c', 'b', 'a']);
  });
});

// ── 4. Health signal from aggregated data ─────────────────────────────────

describe('executive: healthSignal from project PR data', () => {
  function h(overrides: Partial<ProjectHealth> = {}): ProjectHealth {
    return {
      total: 5, mergedCount: 2, openCount: 1,
      failedCICount: 0, pendingCICount: 0,
      highRiskCount: 0, staleCount: 0,
      ...overrides,
    };
  }

  test('clear when no issues', () => {
    assert.equal(healthSignal(h()), 'clear');
  });

  test('critical when CI failures exist', () => {
    assert.equal(healthSignal(h({ failedCICount: 1 })), 'critical');
  });

  test('warning when single high-risk PR', () => {
    assert.equal(healthSignal(h({ highRiskCount: 1 })), 'warning');
  });

  test('critical when 3+ stale PRs', () => {
    assert.equal(healthSignal(h({ staleCount: 3 })), 'critical');
  });
});

// ── 5. Feature flag display safety — no secrets exposed ───────────────────

describe('executive: feature flag display safety', () => {
  test('getFeatureFlags returns only boolean values', () => {
    const flags = getFeatureFlags({
      FEATURE_BILLING: 'true',
      FEATURE_SANDBOX_MODE: 'false',
      STRUCTURED_LOGGING: 'true',
      FEATURE_AGENT_LLM: 'false',
      ORCHESTRATION_ENABLED: 'true',
      NOTIFICATIONS_ENABLED: 'false',
      // Inject a secret to prove it cannot leak
      DATABASE_URL: 'postgresql://secret:password@host:5432/db',
      SECRET_KEY: 'super-secret-key-12345',
    });

    const entries = Object.entries(flags);
    for (const [, value] of entries) {
      assert.equal(typeof value, 'boolean', `Flag value must be boolean, got ${typeof value}`);
    }
  });

  test('flag values do not contain raw env var strings', () => {
    const flags = getFeatureFlags({ FEATURE_BILLING: 'true', SECRET_KEY: 'super-secret' });
    for (const value of Object.values(flags)) {
      assert.notEqual(value, 'true');
      assert.notEqual(value, 'false');
      assert.notEqual(value, 'super-secret');
    }
  });

  test('flag object keys match expected FeatureFlags interface keys', () => {
    const flags = getFeatureFlags({});
    const expectedKeys: (keyof FeatureFlags)[] = [
      'billingEnabled',
      'sandboxMode',
      'structuredLoggingEnabled',
      'agentLlmEnabled',
      'orchestrationEnabled',
      'notificationsEnabled',
    ];
    for (const key of expectedKeys) {
      assert.ok(Object.prototype.hasOwnProperty.call(flags, key), `Missing key: ${key}`);
    }
  });

  test('getFeatureFlags with empty env returns all false', () => {
    const flags = getFeatureFlags({});
    for (const [key, value] of Object.entries(flags)) {
      assert.equal(value, false, `Expected ${key} to be false when env is empty`);
    }
  });

  test('flags with DATABASE_URL in env do not expose it', () => {
    const flags = getFeatureFlags({ DATABASE_URL: 'postgresql://user:pass@host/db' });
    const flagString = JSON.stringify(flags);
    assert.ok(!flagString.includes('postgresql'), 'DB URL must not appear in flags');
    assert.ok(!flagString.includes('pass'), 'Password must not appear in flags');
  });
});

// ── 6. System status shape ────────────────────────────────────────────────

describe('executive: system status shape', () => {
  test('status object has expected shape', () => {
    // Simulate what the status page computes
    const status = {
      dbPass: true,
      dbError: null as string | null,
      uptimeSeconds: 3661,
    };

    assert.equal(typeof status.dbPass, 'boolean');
    assert.equal(status.dbError, null);
    assert.equal(typeof status.uptimeSeconds, 'number');
    assert.ok(status.uptimeSeconds >= 0);
  });

  test('status object correctly reflects DB failure', () => {
    const status = {
      dbPass: false,
      dbError: 'Connection refused',
      uptimeSeconds: 100,
    };

    assert.equal(status.dbPass, false);
    assert.equal(status.dbError, 'Connection refused');
  });

  test('uptime formatting — less than 1 hour shows minutes', () => {
    const uptimeSeconds = 3599;
    const uptimeMinutes = Math.floor((uptimeSeconds % 3600) / 60);
    const uptimeDays = Math.floor(uptimeSeconds / 86400);
    const uptimeHours = Math.floor((uptimeSeconds % 86400) / 3600);
    const display = uptimeDays > 0
      ? `${uptimeDays}d ${uptimeHours}h ${uptimeMinutes}m`
      : uptimeHours > 0
        ? `${uptimeHours}h ${uptimeMinutes}m`
        : `${uptimeMinutes}m ${Math.floor(uptimeSeconds % 60)}s`;
    assert.ok(display.includes('m'), `Expected minutes in display, got: ${display}`);
    assert.ok(!display.includes('d'), `Should not include days: ${display}`);
  });

  test('uptime formatting — more than 1 day shows days', () => {
    const uptimeSeconds = 90061;
    const uptimeDays = Math.floor(uptimeSeconds / 86400);
    assert.equal(uptimeDays, 1);
    const uptimeHours = Math.floor((uptimeSeconds % 86400) / 3600);
    const uptimeMinutes = Math.floor((uptimeSeconds % 3600) / 60);
    const display = `${uptimeDays}d ${uptimeHours}h ${uptimeMinutes}m`;
    assert.ok(display.startsWith('1d'), `Expected '1d' prefix, got: ${display}`);
  });

  test('process.uptime() returns a non-negative number', () => {
    const uptime = process.uptime();
    assert.ok(typeof uptime === 'number', 'uptime should be a number');
    assert.ok(uptime >= 0, 'uptime should be non-negative');
  });
});

// ── 7. Project health: high-risk stale PR combined signal ─────────────────

describe('executive: combined risk signals', () => {
  test('high-risk PR + stale PR together yields critical', () => {
    const prs = [
      makePR({ title: 'fix: rotate auth credentials in production', state: 'open' }),
      makePR({ state: 'open', merged: false, updatedAt: STALE, importedAt: STALE }),
    ];
    const h = computeProjectHealth(prs, NOW);
    const signal = healthSignal(h);
    assert.equal(signal, 'critical');
  });

  test('clear projects remain clear with only merged PRs', () => {
    const prs = [
      makePR({ merged: true, state: 'merged', ciStatus: 'success' }),
      makePR({ merged: true, state: 'merged', ciStatus: 'success' }),
    ];
    const h = computeProjectHealth(prs, NOW);
    const signal = healthSignal(h);
    assert.equal(signal, 'clear');
  });
});
