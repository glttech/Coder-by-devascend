import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildBugRecord,
  extractBugs,
  linkBugs,
  computeBugSummary,
  sortBugs,
} from '../bugIntelligence.js';
import type { TimelinePR } from '../buildTimeline.js';

function makePR(overrides: Partial<TimelinePR> & { id: string }): TimelinePR {
  return {
    prNumber: 1,
    title: 'test PR',
    author: 'alice',
    prUrl: 'https://github.com/org/repo/pull/1',
    state: 'merged',
    merged: true,
    ciStatus: 'success',
    classification: 'bug_fix',
    bugState: null,
    labels: [],
    filesChangedCount: 2,
    githubMergedAt: new Date('2026-06-10T10:00:00Z'),
    githubCreatedAt: new Date('2026-06-09T10:00:00Z'),
    milestoneId: null,
    milestoneTitle: null,
    ...overrides,
  };
}

// ── buildBugRecord ────────────────────────────────────────────────────────────

describe('buildBugRecord', () => {
  test('returns null for non-bug feature PR', () => {
    const pr = makePR({ id: 'a', classification: 'feature', bugState: null });
    assert.equal(buildBugRecord(pr), null);
  });

  test('returns null for chore PR with no bugState', () => {
    const pr = makePR({ id: 'a', classification: 'chore', bugState: null });
    assert.equal(buildBugRecord(pr), null);
  });

  test('builds record for bug_fix PR', () => {
    const pr = makePR({ id: 'a', classification: 'bug_fix', merged: true, ciStatus: 'success' });
    const record = buildBugRecord(pr);
    assert.ok(record !== null);
    assert.equal(record!.id, 'a');
    assert.equal(record!.bugState, 'fixed');
  });

  test('builds record for incident PR', () => {
    const pr = makePR({ id: 'b', classification: 'incident' });
    const record = buildBugRecord(pr);
    assert.ok(record !== null);
  });

  test('builds record for feature PR that has a bugState set', () => {
    const pr = makePR({ id: 'c', classification: 'feature', bugState: 'regression_risk' });
    const record = buildBugRecord(pr);
    assert.ok(record !== null);
    assert.equal(record!.bugState, 'regression_risk');
  });

  test('merged bug_fix with success CI → fixed', () => {
    const pr = makePR({ id: 'd', merged: true, ciStatus: 'success', bugState: null });
    assert.equal(buildBugRecord(pr)!.bugState, 'fixed');
  });

  test('merged bug_fix with failure CI → regression_risk', () => {
    const pr = makePR({ id: 'e', merged: true, ciStatus: 'failure', bugState: null });
    assert.equal(buildBugRecord(pr)!.bugState, 'regression_risk');
  });

  test('open bug_fix → known_issue', () => {
    const pr = makePR({ id: 'f', merged: false, state: 'open', bugState: null });
    assert.equal(buildBugRecord(pr)!.bugState, 'known_issue');
  });

  test('explicit bugState overrides inferred value', () => {
    const pr = makePR({ id: 'g', merged: true, ciStatus: 'success', bugState: 'needs_retest' });
    assert.equal(buildBugRecord(pr)!.bugState, 'needs_retest');
  });

  test('causedByPrId starts as null', () => {
    const record = buildBugRecord(makePR({ id: 'h' }));
    assert.equal(record!.causedByPrId, null);
  });

  test('state is "merged" when pr.merged is true', () => {
    const record = buildBugRecord(makePR({ id: 'i', merged: true }));
    assert.equal(record!.state, 'merged');
  });

  test('state is "open" when pr.merged=false and state="open"', () => {
    const record = buildBugRecord(makePR({ id: 'j', merged: false, state: 'open' }));
    assert.equal(record!.state, 'open');
  });
});

// ── extractBugs ───────────────────────────────────────────────────────────────

describe('extractBugs', () => {
  test('empty input returns empty array', () => {
    assert.equal(extractBugs([]).length, 0);
  });

  test('filters out non-bug PRs', () => {
    const prs = [
      makePR({ id: 'a', classification: 'feature', bugState: null }),
      makePR({ id: 'b', classification: 'bug_fix' }),
      makePR({ id: 'c', classification: 'docs', bugState: null }),
    ];
    const bugs = extractBugs(prs);
    assert.equal(bugs.length, 1);
    assert.equal(bugs[0].id, 'b');
  });

  test('includes PR with explicit bugState even if not bug_fix', () => {
    const prs = [
      makePR({ id: 'a', classification: 'feature', bugState: 'regression_risk' }),
    ];
    assert.equal(extractBugs(prs).length, 1);
  });
});

// ── linkBugs ─────────────────────────────────────────────────────────────────

describe('linkBugs', () => {
  test('links fix PR to caused-by PR via title reference', () => {
    const fixPR = makePR({
      id: 'fix-1',
      prNumber: 10,
      title: 'fix: login error (fixes #5)',
      classification: 'bug_fix',
    });
    const causePR = makePR({
      id: 'cause-1',
      prNumber: 5,
      title: 'feat: refactor auth',
      classification: 'feature',
      bugState: null,
    });

    const bugs = extractBugs([fixPR]);
    const allPRs = [fixPR, causePR];
    const linked = linkBugs(bugs, allPRs);

    assert.equal(linked.length, 1);
    assert.equal(linked[0].causedByPrId, 'cause-1');
  });

  test('no link when no reference in title', () => {
    const fixPR = makePR({
      id: 'fix-1',
      prNumber: 10,
      title: 'fix: login null pointer',
      classification: 'bug_fix',
    });
    const bugs = linkBugs(extractBugs([fixPR]), [fixPR]);
    assert.equal(bugs[0].causedByPrId, null);
  });

  test('handles empty allPRs gracefully', () => {
    const bugs = extractBugs([makePR({ id: 'a', classification: 'bug_fix' })]);
    assert.doesNotThrow(() => linkBugs(bugs, []));
  });
});

// ── computeBugSummary ─────────────────────────────────────────────────────────

describe('computeBugSummary', () => {
  test('empty → all zeros', () => {
    const s = computeBugSummary([]);
    assert.equal(s.total, 0);
    assert.equal(s.open, 0);
    assert.equal(s.fixed, 0);
    assert.equal(s.regressionRisk, 0);
    assert.equal(s.needsRetest, 0);
  });

  test('counts states correctly', () => {
    const bugs = [
      buildBugRecord(makePR({ id: 'a', bugState: 'known_issue', merged: false, state: 'open' }))!,
      buildBugRecord(makePR({ id: 'b', bugState: 'fixed', merged: true, ciStatus: 'success' }))!,
      buildBugRecord(makePR({ id: 'c', bugState: 'regression_risk', merged: true, ciStatus: 'failure' }))!,
    ];
    const s = computeBugSummary(bugs);
    assert.equal(s.open, 1);
    assert.equal(s.fixed, 1);
    assert.equal(s.regressionRisk, 1);
    assert.equal(s.total, 3);
  });

  test('byArea groups bugs by area', () => {
    const prs = [
      makePR({ id: 'a', title: 'fix auth login bug', classification: 'bug_fix' }),
      makePR({ id: 'b', title: 'fix auth session', classification: 'bug_fix' }),
      makePR({ id: 'c', title: 'fix payment checkout', classification: 'bug_fix' }),
    ];
    const bugs = extractBugs(prs);
    const s = computeBugSummary(bugs);
    assert.equal(s.byArea['auth'], 2);
    assert.equal(s.byArea['payments'], 1);
  });
});

// ── sortBugs ──────────────────────────────────────────────────────────────────

describe('sortBugs', () => {
  test('regression_risk comes before known_issue', () => {
    const bugs = [
      buildBugRecord(makePR({ id: 'a', bugState: 'known_issue', merged: false, state: 'open' }))!,
      buildBugRecord(makePR({ id: 'b', bugState: 'regression_risk', merged: true, ciStatus: 'failure' }))!,
    ];
    const sorted = sortBugs(bugs);
    assert.equal(sorted[0].bugState, 'regression_risk');
  });

  test('fixed comes last', () => {
    const bugs = [
      buildBugRecord(makePR({ id: 'a', bugState: 'fixed', merged: true, ciStatus: 'success' }))!,
      buildBugRecord(makePR({ id: 'b', bugState: 'known_issue', merged: false, state: 'open' }))!,
    ];
    const sorted = sortBugs(bugs);
    assert.equal(sorted[sorted.length - 1].bugState, 'fixed');
  });

  test('within same state, newer first', () => {
    const older = buildBugRecord(makePR({
      id: 'a',
      bugState: 'fixed',
      merged: true,
      ciStatus: 'success',
      githubMergedAt: new Date('2026-06-01T00:00:00Z'),
    }))!;
    const newer = buildBugRecord(makePR({
      id: 'b',
      bugState: 'fixed',
      merged: true,
      ciStatus: 'success',
      githubMergedAt: new Date('2026-06-15T00:00:00Z'),
    }))!;
    const sorted = sortBugs([older, newer]);
    assert.equal(sorted[0].id, 'b');
  });

  test('does not mutate original array', () => {
    const bugs = [
      buildBugRecord(makePR({ id: 'a', bugState: 'fixed', merged: true, ciStatus: 'success' }))!,
      buildBugRecord(makePR({ id: 'b', bugState: 'known_issue', merged: false, state: 'open' }))!,
    ];
    const original = [...bugs];
    sortBugs(bugs);
    assert.equal(bugs[0].id, original[0].id);
  });
});
