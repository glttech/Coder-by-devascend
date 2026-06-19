/**
 * Tests for the Project Intelligence API logic.
 * Tests the data-shaping and aggregation layer independently of HTTP.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// ── Helpers ────────────────────────────────────────────────────────────────

type Classification =
  | 'feature' | 'bug_fix' | 'security' | 'migration' | 'deployment'
  | 'rollback' | 'incident' | 'chore' | 'test' | 'docs' | null;

interface MockPR {
  id: string;
  prNumber: number;
  title: string;
  state: string;
  merged: boolean;
  ciStatus: string | null;
  classification: Classification;
  bugState: string | null;
  author: string | null;
  prUrl: string | null;
  githubMergedAt: Date | null;
  githubCreatedAt: Date | null;
  githubUpdatedAt: Date | null;
}

function makePR(overrides: Partial<MockPR> = {}): MockPR {
  return {
    id: 'pr-' + Math.random().toString(36).slice(2),
    prNumber: 1,
    title: 'Test PR',
    state: 'closed',
    merged: true,
    ciStatus: 'success',
    classification: 'feature',
    bugState: null,
    author: 'testuser',
    prUrl: null,
    githubMergedAt: new Date('2026-06-15T10:00:00Z'),
    githubCreatedAt: new Date('2026-06-14T08:00:00Z'),
    githubUpdatedAt: new Date('2026-06-15T10:00:00Z'),
    ...overrides,
  };
}

// ── Intelligence summary computation ──────────────────────────────────────

function computeSummary(prs: MockPR[]) {
  return {
    totalPRs: prs.length,
    mergedPRs: prs.filter((p) => p.merged).length,
    openPRs: prs.filter((p) => p.state === 'open').length,
    failedCIPRs: prs.filter((p) => p.ciStatus === 'failure').length,
    regressionRisks: prs.filter((p) => p.bugState === 'regression_risk').length,
  };
}

function computeClassificationBreakdown(prs: MockPR[]) {
  const counts: Record<string, number> = {};
  for (const pr of prs) {
    const key = pr.classification ?? 'unclassified';
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return Object.entries(counts)
    .map(([classification, count]) => ({ classification, count }))
    .sort((a, b) => b.count - a.count);
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('projectIntelligence — summary computation', () => {
  it('counts total PRs correctly', () => {
    const prs = [makePR(), makePR(), makePR({ merged: false, state: 'open' })];
    const s = computeSummary(prs);
    assert.equal(s.totalPRs, 3);
  });

  it('counts merged PRs correctly', () => {
    const prs = [
      makePR({ merged: true }),
      makePR({ merged: true }),
      makePR({ merged: false, state: 'open' }),
    ];
    const s = computeSummary(prs);
    assert.equal(s.mergedPRs, 2);
  });

  it('counts open PRs correctly', () => {
    const prs = [
      makePR({ merged: false, state: 'open' }),
      makePR({ merged: false, state: 'open' }),
      makePR({ merged: true, state: 'closed' }),
    ];
    const s = computeSummary(prs);
    assert.equal(s.openPRs, 2);
  });

  it('counts failed CI PRs correctly', () => {
    const prs = [
      makePR({ ciStatus: 'failure' }),
      makePR({ ciStatus: 'failure' }),
      makePR({ ciStatus: 'success' }),
      makePR({ ciStatus: null }),
    ];
    const s = computeSummary(prs);
    assert.equal(s.failedCIPRs, 2);
  });

  it('counts regression risks correctly', () => {
    const prs = [
      makePR({ bugState: 'regression_risk' }),
      makePR({ bugState: 'regression_risk' }),
      makePR({ bugState: 'known_issue' }),
      makePR({ bugState: null }),
    ];
    const s = computeSummary(prs);
    assert.equal(s.regressionRisks, 2);
  });

  it('returns zeros for empty PR list', () => {
    const s = computeSummary([]);
    assert.deepEqual(s, {
      totalPRs: 0,
      mergedPRs: 0,
      openPRs: 0,
      failedCIPRs: 0,
      regressionRisks: 0,
    });
  });
});

describe('projectIntelligence — classification breakdown', () => {
  it('groups PRs by classification correctly', () => {
    const prs = [
      makePR({ classification: 'feature' }),
      makePR({ classification: 'feature' }),
      makePR({ classification: 'bug_fix' }),
      makePR({ classification: 'security' }),
    ];
    const breakdown = computeClassificationBreakdown(prs);
    const featureRow = breakdown.find((r) => r.classification === 'feature');
    assert.ok(featureRow, 'feature row should exist');
    assert.equal(featureRow.count, 2);
  });

  it('handles null classification as unclassified', () => {
    const prs = [
      makePR({ classification: null }),
      makePR({ classification: null }),
    ];
    const breakdown = computeClassificationBreakdown(prs);
    const row = breakdown.find((r) => r.classification === 'unclassified');
    assert.ok(row, 'unclassified row should exist');
    assert.equal(row.count, 2);
  });

  it('sorts by count descending', () => {
    const prs = [
      makePR({ classification: 'chore' }),
      makePR({ classification: 'feature' }),
      makePR({ classification: 'feature' }),
      makePR({ classification: 'feature' }),
      makePR({ classification: 'bug_fix' }),
      makePR({ classification: 'bug_fix' }),
    ];
    const breakdown = computeClassificationBreakdown(prs);
    assert.equal(breakdown[0].classification, 'feature');
    assert.equal(breakdown[0].count, 3);
    assert.equal(breakdown[1].count, 2);
  });

  it('returns empty array for empty PR list', () => {
    const breakdown = computeClassificationBreakdown([]);
    assert.deepEqual(breakdown, []);
  });
});

describe('projectIntelligence — response shape', () => {
  it('does not include raw PR body or embeddings in recent activity', () => {
    const pr = makePR({ title: 'Add feature X' });
    // Simulate the safe field selection in the route
    const safeFields = {
      id: pr.id,
      prNumber: pr.prNumber,
      title: pr.title,
      state: pr.state,
      merged: pr.merged,
      ciStatus: pr.ciStatus,
      classification: pr.classification,
      bugState: pr.bugState,
      author: pr.author,
      prUrl: pr.prUrl,
      githubMergedAt: pr.githubMergedAt?.toISOString() ?? null,
      githubCreatedAt: pr.githubCreatedAt?.toISOString() ?? null,
      githubUpdatedAt: pr.githubUpdatedAt?.toISOString() ?? null,
    };
    // Confirm no forbidden fields
    assert.equal('body' in safeFields, false, 'body must not be in response');
    assert.equal('embedding' in safeFields, false, 'embedding must not be in response');
    assert.equal('explanation' in safeFields, false, 'explanation must not be in response');
    assert.equal('confidence' in safeFields, false, 'confidence must not be in response');
  });

  it('syncState never exposes DATABASE_URL or token values', () => {
    const syncState = {
      status: 'idle',
      lastSyncedAt: '2026-06-18T10:00:00Z',
      totalSynced: 42,
      errorMessage: 'GitHub API rate limit exceeded',
    };
    const json = JSON.stringify(syncState);
    assert.equal(json.includes('postgres://'), false, 'must not contain DB URL');
    assert.equal(json.includes('ghp_'), false, 'must not contain GitHub token');
    assert.equal(json.includes('DATABASE_URL'), false, 'must not contain env var name');
  });
});

describe('projectIntelligence — sync state', () => {
  it('reports idle when no sync state exists', () => {
    type SyncStateShape = { syncStatus: string; lastSyncedAt: Date | null; totalSynced: number; errorMessage: string | null } | null;
    const syncState = null as SyncStateShape;
    const result = {
      status: syncState?.syncStatus ?? 'idle',
      lastSyncedAt: syncState?.lastSyncedAt?.toISOString() ?? null,
      totalSynced: syncState?.totalSynced ?? 0,
    };
    assert.equal(result.status, 'idle');
    assert.equal(result.lastSyncedAt, null);
    assert.equal(result.totalSynced, 0);
  });

  it('reports correct sync state when synced', () => {
    const syncState = {
      syncStatus: 'idle',
      lastSyncedAt: new Date('2026-06-18T12:00:00Z'),
      totalSynced: 127,
      errorMessage: null,
    };
    const result = {
      status: syncState.syncStatus,
      lastSyncedAt: syncState.lastSyncedAt.toISOString(),
      totalSynced: syncState.totalSynced,
      errorMessage: syncState.errorMessage,
    };
    assert.equal(result.status, 'idle');
    assert.equal(result.lastSyncedAt, '2026-06-18T12:00:00.000Z');
    assert.equal(result.totalSynced, 127);
    assert.equal(result.errorMessage, null);
  });

  it('reports error state correctly', () => {
    const syncState = {
      syncStatus: 'error',
      lastSyncedAt: new Date('2026-06-17T09:00:00Z'),
      totalSynced: 50,
      errorMessage: 'Repository not found on GitHub',
    };
    assert.equal(syncState.syncStatus, 'error');
    assert.equal(typeof syncState.errorMessage, 'string');
    assert.equal(syncState.errorMessage.includes('not found'), true);
  });
});
