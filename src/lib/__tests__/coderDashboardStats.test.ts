import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSessionStats, buildTaskStats, buildPrStatsFromList, todayUTC } from '../coder/dashboardStats.js';

// ── todayUTC ─────────────────────────────────────────────────────────────────

describe('todayUTC', () => {
  test('returns midnight UTC today', () => {
    const d = todayUTC();
    assert.equal(d.getUTCHours(), 0);
    assert.equal(d.getUTCMinutes(), 0);
    assert.equal(d.getUTCSeconds(), 0);
    assert.equal(d.getUTCMilliseconds(), 0);
  });

  test('is in the past or present', () => {
    assert.ok(todayUTC().getTime() <= Date.now());
  });
});

// ── buildSessionStats ────────────────────────────────────────────────────────

describe('buildSessionStats — empty', () => {
  test('returns zeros on empty list', () => {
    const stats = buildSessionStats([], new Date());
    assert.equal(stats.active, 0);
    assert.equal(stats.pending, 0);
    assert.equal(stats.completedToday, 0);
    assert.equal(stats.failedToday, 0);
    assert.equal(stats.totalSessions, 0);
  });
});

describe('buildSessionStats — active / pending', () => {
  const today = new Date('2026-06-21T00:00:00.000Z');

  test('counts running sessions as active', () => {
    const sessions = [
      { status: 'running', startedAt: new Date(), completedAt: null },
      { status: 'running', startedAt: new Date(), completedAt: null },
    ];
    const stats = buildSessionStats(sessions, today);
    assert.equal(stats.active, 2);
  });

  test('counts pending sessions', () => {
    const sessions = [
      { status: 'pending', startedAt: null, completedAt: null },
    ];
    const stats = buildSessionStats(sessions, today);
    assert.equal(stats.pending, 1);
    assert.equal(stats.active, 0);
  });

  test('counts total correctly', () => {
    const sessions = [
      { status: 'running', startedAt: new Date(), completedAt: null },
      { status: 'completed', startedAt: new Date(), completedAt: new Date() },
      { status: 'failed', startedAt: new Date(), completedAt: new Date() },
    ];
    assert.equal(buildSessionStats(sessions, today).totalSessions, 3);
  });
});

describe('buildSessionStats — today aggregates', () => {
  const today = new Date('2026-06-21T00:00:00.000Z');
  const yesterday = new Date('2026-06-20T12:00:00.000Z');
  const nowish = new Date('2026-06-21T10:00:00.000Z');

  test('counts completedToday for sessions finished today', () => {
    const sessions = [
      { status: 'completed', startedAt: nowish, completedAt: nowish },
      { status: 'completed', startedAt: yesterday, completedAt: yesterday },
    ];
    assert.equal(buildSessionStats(sessions, today).completedToday, 1);
  });

  test('counts failedToday for sessions failed today', () => {
    const sessions = [
      { status: 'failed', startedAt: nowish, completedAt: nowish },
    ];
    assert.equal(buildSessionStats(sessions, today).failedToday, 1);
  });

  test('does not count yesterday failures as today', () => {
    const sessions = [
      { status: 'failed', startedAt: yesterday, completedAt: yesterday },
    ];
    assert.equal(buildSessionStats(sessions, today).failedToday, 0);
  });

  test('uses startedAt as fallback when completedAt is null', () => {
    const sessions = [
      { status: 'completed', startedAt: nowish, completedAt: null },
    ];
    assert.equal(buildSessionStats(sessions, today).completedToday, 1);
  });
});

// ── buildTaskStats ────────────────────────────────────────────────────────────

describe('buildTaskStats — open count', () => {
  test('returns 0 open for empty list', () => {
    assert.equal(buildTaskStats([]).open, 0);
  });

  test('excludes completed tasks from open count', () => {
    const tasks = [
      { status: 'completed', riskLevel: 'low', approvalRequired: false, approval: null },
    ];
    assert.equal(buildTaskStats(tasks).open, 0);
  });

  test('includes non-terminal tasks in open count', () => {
    const tasks = [
      { status: 'pending', riskLevel: 'low', approvalRequired: false, approval: null },
      { status: 'in_progress', riskLevel: 'high', approvalRequired: false, approval: null },
    ];
    assert.equal(buildTaskStats(tasks).open, 2);
  });

  test('excludes approved/failed/cancelled', () => {
    const tasks = [
      { status: 'approved', riskLevel: 'low', approvalRequired: false, approval: null },
      { status: 'failed', riskLevel: 'low', approvalRequired: false, approval: null },
      { status: 'cancelled', riskLevel: 'low', approvalRequired: false, approval: null },
    ];
    assert.equal(buildTaskStats(tasks).open, 0);
  });
});

describe('buildTaskStats — byRisk', () => {
  test('segments open tasks by risk level', () => {
    const tasks = [
      { status: 'pending', riskLevel: 'high', approvalRequired: false, approval: null },
      { status: 'pending', riskLevel: 'medium', approvalRequired: false, approval: null },
      { status: 'pending', riskLevel: 'medium', approvalRequired: false, approval: null },
      { status: 'pending', riskLevel: 'low', approvalRequired: false, approval: null },
    ];
    const { byRisk } = buildTaskStats(tasks);
    assert.equal(byRisk.high, 1);
    assert.equal(byRisk.medium, 2);
    assert.equal(byRisk.low, 1);
    assert.equal(byRisk.unknown, 0);
  });

  test('puts unrecognised risk level in unknown bucket', () => {
    const tasks = [
      { status: 'pending', riskLevel: 'critical', approvalRequired: false, approval: null },
    ];
    assert.equal(buildTaskStats(tasks).byRisk.unknown, 1);
  });

  test('does not count terminal task risk', () => {
    const tasks = [
      { status: 'completed', riskLevel: 'high', approvalRequired: false, approval: null },
    ];
    assert.equal(buildTaskStats(tasks).byRisk.high, 0);
  });
});

describe('buildTaskStats — pendingApproval', () => {
  test('counts tasks that require approval but have none', () => {
    const tasks = [
      { status: 'pending', riskLevel: 'high', approvalRequired: true, approval: null },
    ];
    assert.equal(buildTaskStats(tasks).pendingApproval, 1);
  });

  test('does not count tasks where approval is already granted', () => {
    const tasks = [
      { status: 'pending', riskLevel: 'high', approvalRequired: true, approval: { approved: true } },
    ];
    assert.equal(buildTaskStats(tasks).pendingApproval, 0);
  });

  test('does not count tasks that do not require approval', () => {
    const tasks = [
      { status: 'pending', riskLevel: 'low', approvalRequired: false, approval: null },
    ];
    assert.equal(buildTaskStats(tasks).pendingApproval, 0);
  });
});

// ── buildPrStatsFromList ──────────────────────────────────────────────────────

describe('buildPrStatsFromList — empty', () => {
  test('returns zeros on empty list', () => {
    const stats = buildPrStatsFromList([], new Date());
    assert.equal(stats.open, 0);
    assert.equal(stats.mergedToday, 0);
    assert.equal(stats.ciFailure, 0);
  });
});

describe('buildPrStatsFromList — counts', () => {
  const today = new Date('2026-06-21T00:00:00.000Z');
  const nowish = new Date('2026-06-21T10:00:00.000Z');
  const yesterday = new Date('2026-06-20T12:00:00.000Z');

  test('counts open PRs', () => {
    const prs = [
      { state: 'open', merged: false, ciStatus: null, githubMergedAt: null },
      { state: 'open', merged: false, ciStatus: null, githubMergedAt: null },
      { state: 'closed', merged: false, ciStatus: null, githubMergedAt: null },
    ];
    assert.equal(buildPrStatsFromList(prs, today).open, 2);
  });

  test('counts mergedToday for PRs merged today', () => {
    const prs = [
      { state: 'closed', merged: true, ciStatus: 'success', githubMergedAt: nowish },
      { state: 'closed', merged: true, ciStatus: 'success', githubMergedAt: yesterday },
    ];
    assert.equal(buildPrStatsFromList(prs, today).mergedToday, 1);
  });

  test('counts CI failures', () => {
    const prs = [
      { state: 'open', merged: false, ciStatus: 'failure', githubMergedAt: null },
      { state: 'open', merged: false, ciStatus: 'success', githubMergedAt: null },
    ];
    assert.equal(buildPrStatsFromList(prs, today).ciFailure, 1);
  });

  test('does not count non-merged PRs as mergedToday', () => {
    const prs = [
      { state: 'closed', merged: false, ciStatus: null, githubMergedAt: nowish },
    ];
    assert.equal(buildPrStatsFromList(prs, today).mergedToday, 0);
  });
});
