import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { computeProjectHealth, healthSignal, computeStalePRs } from '../projectHealth.js';
import type { PRHealthInput, PRHealthInputWithId, ProjectHealth } from '../projectHealth.js';

const NOW = new Date('2026-06-05T12:00:00Z');
const RECENT = new Date('2026-06-04T12:00:00Z');    // 1 day ago — not stale
const STALE  = new Date('2026-05-20T12:00:00Z');    // 16 days ago — stale

function pr(overrides: Partial<PRHealthInput> = {}): PRHealthInput {
  return {
    title: 'feat: add button',
    body: null,
    state: 'open',
    merged: false,
    ciStatus: 'success',
    importedAt: RECENT,
    updatedAt: RECENT,
    ...overrides,
  };
}

// ── computeProjectHealth — empty ───────────────────────────────────────────

describe('computeProjectHealth — empty input', () => {
  test('all zeros for empty array', () => {
    const h = computeProjectHealth([], NOW);
    assert.deepEqual(h, {
      total: 0, mergedCount: 0, openCount: 0,
      failedCICount: 0, pendingCICount: 0,
      highRiskCount: 0, staleCount: 0,
    });
  });
});

// ── computeProjectHealth — total ──────────────────────────────────────────

describe('computeProjectHealth — total count', () => {
  test('counts all PRs', () => {
    const h = computeProjectHealth([pr(), pr(), pr()], NOW);
    assert.equal(h.total, 3);
  });
});

// ── computeProjectHealth — merged ─────────────────────────────────────────

describe('computeProjectHealth — mergedCount', () => {
  test('counts merged PRs', () => {
    const h = computeProjectHealth([
      pr({ merged: true, state: 'merged' }),
      pr({ merged: true, state: 'merged' }),
      pr({ merged: false, state: 'open' }),
    ], NOW);
    assert.equal(h.mergedCount, 2);
  });

  test('zero when no PRs merged', () => {
    assert.equal(computeProjectHealth([pr()], NOW).mergedCount, 0);
  });
});

// ── computeProjectHealth — openCount ──────────────────────────────────────

describe('computeProjectHealth — openCount', () => {
  test('counts open unmerged PRs', () => {
    const h = computeProjectHealth([
      pr({ state: 'open', merged: false }),
      pr({ state: 'open', merged: false }),
      pr({ state: 'merged', merged: true }),
    ], NOW);
    assert.equal(h.openCount, 2);
  });

  test('merged PR with state open is NOT counted as open', () => {
    const h = computeProjectHealth([pr({ state: 'open', merged: true })], NOW);
    assert.equal(h.openCount, 0);
  });
});

// ── computeProjectHealth — failedCICount ──────────────────────────────────

describe('computeProjectHealth — failedCICount', () => {
  test('counts PRs with ciStatus=failure', () => {
    const h = computeProjectHealth([
      pr({ ciStatus: 'failure' }),
      pr({ ciStatus: 'failure' }),
      pr({ ciStatus: 'success' }),
    ], NOW);
    assert.equal(h.failedCICount, 2);
  });

  test('zero when no failures', () => {
    assert.equal(computeProjectHealth([pr({ ciStatus: 'success' })], NOW).failedCICount, 0);
  });
});

// ── computeProjectHealth — pendingCICount ─────────────────────────────────

describe('computeProjectHealth — pendingCICount', () => {
  test('counts PRs with ciStatus=pending', () => {
    const h = computeProjectHealth([pr({ ciStatus: 'pending' }), pr({ ciStatus: 'success' })], NOW);
    assert.equal(h.pendingCICount, 1);
  });

  test('counts PRs with ciStatus=null (unknown)', () => {
    const h = computeProjectHealth([pr({ ciStatus: null }), pr({ ciStatus: 'success' })], NOW);
    assert.equal(h.pendingCICount, 1);
  });

  test('counts both pending and null', () => {
    const h = computeProjectHealth([
      pr({ ciStatus: 'pending' }),
      pr({ ciStatus: null }),
      pr({ ciStatus: 'success' }),
    ], NOW);
    assert.equal(h.pendingCICount, 2);
  });

  test('zero for all success/failure/neutral', () => {
    const h = computeProjectHealth([pr({ ciStatus: 'success' }), pr({ ciStatus: 'failure' })], NOW);
    assert.equal(h.pendingCICount, 0);
  });
});

// ── computeProjectHealth — highRiskCount ──────────────────────────────────

describe('computeProjectHealth — highRiskCount', () => {
  test('counts high-risk PRs (auth keyword)', () => {
    const h = computeProjectHealth([
      pr({ title: 'feat: refactor authentication flow' }),
      pr({ title: 'fix: button color' }),
    ], NOW);
    assert.equal(h.highRiskCount, 1);
  });

  test('security keyword triggers high risk', () => {
    const h = computeProjectHealth([pr({ title: 'fix: security vulnerability in login' })], NOW);
    assert.equal(h.highRiskCount, 1);
  });

  test('low-risk PR does not increment highRiskCount', () => {
    const h = computeProjectHealth([pr({ title: 'chore: update README' })], NOW);
    assert.equal(h.highRiskCount, 0);
  });

  test('multiple high-risk PRs counted correctly', () => {
    const h = computeProjectHealth([
      pr({ title: 'feat: add authentication' }),
      pr({ title: 'fix: security patch' }),
      pr({ title: 'chore: lint' }),
    ], NOW);
    assert.equal(h.highRiskCount, 2);
  });
});

// ── computeProjectHealth — staleCount ─────────────────────────────────────

describe('computeProjectHealth — staleCount', () => {
  test('open PR with stale updatedAt counts as stale', () => {
    const h = computeProjectHealth([
      pr({ state: 'open', merged: false, updatedAt: STALE, importedAt: STALE }),
    ], NOW);
    assert.equal(h.staleCount, 1);
  });

  test('open PR with recent updatedAt is not stale', () => {
    const h = computeProjectHealth([
      pr({ state: 'open', merged: false, updatedAt: RECENT, importedAt: RECENT }),
    ], NOW);
    assert.equal(h.staleCount, 0);
  });

  test('merged PR is never stale even if old', () => {
    const h = computeProjectHealth([
      pr({ state: 'merged', merged: true, updatedAt: STALE, importedAt: STALE }),
    ], NOW);
    assert.equal(h.staleCount, 0);
  });

  test('uses updatedAt if newer than importedAt', () => {
    const h = computeProjectHealth([
      pr({ state: 'open', merged: false, importedAt: STALE, updatedAt: RECENT }),
    ], NOW);
    assert.equal(h.staleCount, 0);
  });

  test('falls back to importedAt when updatedAt is not newer', () => {
    const staleImported = new Date('2026-05-01T00:00:00Z');
    const h = computeProjectHealth([
      pr({ state: 'open', merged: false, importedAt: staleImported, updatedAt: staleImported }),
    ], NOW);
    assert.equal(h.staleCount, 1);
  });
});

// ── healthSignal ───────────────────────────────────────────────────────────

describe('healthSignal', () => {
  function h(overrides: Partial<ProjectHealth> = {}): ProjectHealth {
    return { total: 5, mergedCount: 2, openCount: 1, failedCICount: 0, pendingCICount: 0, highRiskCount: 0, staleCount: 0, ...overrides };
  }

  // ── clear ────────────────────────────────────────────────────────────────
  test('all zeros → clear', () => {
    assert.equal(healthSignal(h()), 'clear');
  });

  test('only mergedCount populated → clear', () => {
    assert.equal(healthSignal(h({ mergedCount: 10 })), 'clear');
  });

  // ── warning — single high-risk, minor stale/pending ──────────────────────
  test('single high-risk PR → warning (not critical)', () => {
    assert.equal(healthSignal(h({ highRiskCount: 1 })), 'warning');
  });

  test('staleCount=1 alone → warning', () => {
    assert.equal(healthSignal(h({ staleCount: 1 })), 'warning');
  });

  test('staleCount=2 alone → warning', () => {
    assert.equal(healthSignal(h({ staleCount: 2 })), 'warning');
  });

  test('pendingCICount > 0 alone → warning', () => {
    assert.equal(healthSignal(h({ pendingCICount: 2 })), 'warning');
  });

  // ── critical — CI failures ────────────────────────────────────────────────
  test('failedCICount > 0 → critical', () => {
    assert.equal(healthSignal(h({ failedCICount: 1 })), 'critical');
  });

  test('CI failures take priority over clean risk/stale', () => {
    assert.equal(healthSignal(h({ failedCICount: 2, staleCount: 1 })), 'critical');
  });

  // ── critical — multiple high-risk PRs ─────────────────────────────────────
  test('two high-risk PRs → critical', () => {
    assert.equal(healthSignal(h({ highRiskCount: 2 })), 'critical');
  });

  test('three high-risk PRs → critical', () => {
    assert.equal(healthSignal(h({ highRiskCount: 3 })), 'critical');
  });

  // ── critical — severe staleness ───────────────────────────────────────────
  test('staleCount=3 → critical (severe)', () => {
    assert.equal(healthSignal(h({ staleCount: 3 })), 'critical');
  });

  test('staleCount=5 → critical', () => {
    assert.equal(healthSignal(h({ staleCount: 5 })), 'critical');
  });

  // ── critical — combined warning signals ───────────────────────────────────
  test('highRisk=1 AND staleCount=1 → critical (combined)', () => {
    assert.equal(healthSignal(h({ highRiskCount: 1, staleCount: 1 })), 'critical');
  });

  test('highRisk=1 AND pendingCI=1 → critical (combined)', () => {
    assert.equal(healthSignal(h({ highRiskCount: 1, pendingCICount: 1 })), 'critical');
  });

  test('highRisk=1 AND staleCount=2 → critical (combined)', () => {
    assert.equal(healthSignal(h({ highRiskCount: 1, staleCount: 2 })), 'critical');
  });

  // ── DEV-observed scenario fix ─────────────────────────────────────────────
  test('DEV scenario: highRisk=1, failedCI=0, pendingCI=0, stale=0 → warning', () => {
    assert.equal(healthSignal(h({ highRiskCount: 1, failedCICount: 0, pendingCICount: 0, staleCount: 0 })), 'warning');
  });
});

// ── computeStalePRs ────────────────────────────────────────────────────────

const STALE2 = new Date('2026-05-20T12:00:00Z'); // 16 days before NOW

function prWithId(overrides: Partial<PRHealthInputWithId> = {}): PRHealthInputWithId {
  return {
    id: 'pr-1',
    prNumber: 1,
    title: 'feat: add button',
    body: null,
    state: 'open',
    merged: false,
    ciStatus: 'success',
    importedAt: RECENT,
    updatedAt: RECENT,
    ...overrides,
  };
}

describe('computeStalePRs — empty / no stale', () => {
  test('empty array returns empty list', () => {
    assert.deepEqual(computeStalePRs([], NOW), []);
  });

  test('recent open PR is not stale', () => {
    assert.deepEqual(computeStalePRs([prWithId()], NOW), []);
  });

  test('merged stale PR is not included', () => {
    const result = computeStalePRs([prWithId({ merged: true, state: 'merged', updatedAt: STALE2, importedAt: STALE2 })], NOW);
    assert.deepEqual(result, []);
  });

  test('closed (not merged) stale PR is not included', () => {
    const result = computeStalePRs([prWithId({ state: 'closed', merged: false, updatedAt: STALE2, importedAt: STALE2 })], NOW);
    assert.deepEqual(result, []);
  });
});

describe('computeStalePRs — stale open PRs', () => {
  test('open stale PR is included with correct fields', () => {
    const result = computeStalePRs([
      prWithId({ id: 'abc', prNumber: 42, title: 'feat: big refactor', updatedAt: STALE2, importedAt: STALE2 }),
    ], NOW);
    assert.equal(result.length, 1);
    assert.equal(result[0].id, 'abc');
    assert.equal(result[0].prNumber, 42);
    assert.equal(result[0].title, 'feat: big refactor');
    assert.equal(result[0].daysSinceRefresh, 16);
  });

  test('uses updatedAt when newer than importedAt', () => {
    const result = computeStalePRs([
      prWithId({ importedAt: STALE2, updatedAt: RECENT }),
    ], NOW);
    assert.deepEqual(result, []); // updatedAt is recent → not stale
  });

  test('falls back to importedAt when updatedAt equals importedAt', () => {
    const result = computeStalePRs([prWithId({ importedAt: STALE2, updatedAt: STALE2 })], NOW);
    assert.equal(result.length, 1);
    assert.equal(result[0].daysSinceRefresh, 16);
  });

  test('multiple stale PRs all returned', () => {
    const result = computeStalePRs([
      prWithId({ id: 'a', prNumber: 1, updatedAt: STALE2, importedAt: STALE2 }),
      prWithId({ id: 'b', prNumber: 2, updatedAt: STALE2, importedAt: STALE2 }),
      prWithId({ id: 'c', prNumber: 3 }), // recent — excluded
    ], NOW);
    assert.equal(result.length, 2);
  });

  test('results sorted oldest-first (highest daysSinceRefresh first)', () => {
    const veryStale = new Date('2026-05-01T12:00:00Z'); // 35 days
    const result = computeStalePRs([
      prWithId({ id: 'newer-stale', prNumber: 10, updatedAt: STALE2, importedAt: STALE2 }),
      prWithId({ id: 'older-stale', prNumber: 20, updatedAt: veryStale, importedAt: veryStale }),
    ], NOW);
    assert.equal(result[0].id, 'older-stale');
    assert.equal(result[1].id, 'newer-stale');
  });
});
