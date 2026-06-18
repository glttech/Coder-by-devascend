import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  groupByWeek,
  groupByDay,
  groupByMilestone,
  groupPRs,
  computeTimelineSummary,
  type TimelinePR,
} from '../buildTimeline.js';

function makePR(overrides: Partial<TimelinePR> & { id: string }): TimelinePR {
  return {
    prNumber: 1,
    title: 'test PR',
    author: 'alice',
    prUrl: null,
    state: 'merged',
    merged: true,
    ciStatus: 'success',
    classification: 'feature',
    bugState: null,
    labels: [],
    filesChangedCount: 3,
    githubMergedAt: new Date('2026-06-09T12:00:00Z'),
    githubCreatedAt: new Date('2026-06-08T10:00:00Z'),
    milestoneId: null,
    milestoneTitle: null,
    ...overrides,
  };
}

// ── groupByWeek ───────────────────────────────────────────────────────────────

describe('groupByWeek', () => {
  test('empty input produces no buckets', () => {
    assert.equal(groupByWeek([]).length, 0);
  });

  test('single PR produces one bucket', () => {
    const prs = [makePR({ id: 'a', githubMergedAt: new Date('2026-06-10T12:00:00Z') })];
    const buckets = groupByWeek(prs);
    assert.equal(buckets.length, 1);
    assert.equal(buckets[0].prCount, 1);
  });

  test('two PRs in same week go into one bucket', () => {
    const prs = [
      makePR({ id: 'a', githubMergedAt: new Date('2026-06-08T10:00:00Z') }),
      makePR({ id: 'b', githubMergedAt: new Date('2026-06-10T10:00:00Z') }),
    ];
    const buckets = groupByWeek(prs);
    assert.equal(buckets.length, 1);
    assert.equal(buckets[0].prCount, 2);
  });

  test('PRs in different weeks go into separate buckets', () => {
    const prs = [
      makePR({ id: 'a', githubMergedAt: new Date('2026-06-01T10:00:00Z') }),
      makePR({ id: 'b', githubMergedAt: new Date('2026-06-15T10:00:00Z') }),
    ];
    const buckets = groupByWeek(prs);
    assert.equal(buckets.length, 2);
  });

  test('buckets are sorted newest first', () => {
    const prs = [
      makePR({ id: 'a', githubMergedAt: new Date('2026-06-01T10:00:00Z') }),
      makePR({ id: 'b', githubMergedAt: new Date('2026-06-15T10:00:00Z') }),
    ];
    const buckets = groupByWeek(prs);
    assert.ok(buckets[0].startDate > buckets[1].startDate);
  });

  test('PR with no date is skipped', () => {
    const prs = [
      makePR({ id: 'a', githubMergedAt: null, githubCreatedAt: null }),
      makePR({ id: 'b', githubMergedAt: new Date('2026-06-10T10:00:00Z') }),
    ];
    const buckets = groupByWeek(prs);
    assert.equal(buckets[0].prCount, 1);
  });

  test('sections are grouped by classification within a bucket', () => {
    const prs = [
      makePR({ id: 'a', classification: 'feature', githubMergedAt: new Date('2026-06-10T10:00:00Z') }),
      makePR({ id: 'b', classification: 'bug_fix', githubMergedAt: new Date('2026-06-11T10:00:00Z') }),
      makePR({ id: 'c', classification: 'bug_fix', githubMergedAt: new Date('2026-06-12T10:00:00Z') }),
    ];
    const buckets = groupByWeek(prs);
    assert.equal(buckets.length, 1);
    const sections = buckets[0].sections;
    const bugSection = sections.find((s) => s.classification === 'bug_fix');
    assert.ok(bugSection);
    assert.equal(bugSection!.prs.length, 2);
  });

  test('bucket label contains week dates', () => {
    const prs = [makePR({ id: 'a', githubMergedAt: new Date('2026-06-15T10:00:00Z') })];
    const buckets = groupByWeek(prs);
    assert.ok(buckets[0].label.includes('Week of'));
  });

  test('featuresCount is accurate', () => {
    const prs = [
      makePR({ id: 'a', classification: 'feature', githubMergedAt: new Date('2026-06-10T10:00:00Z') }),
      makePR({ id: 'b', classification: 'feature', githubMergedAt: new Date('2026-06-10T11:00:00Z') }),
      makePR({ id: 'c', classification: 'bug_fix', githubMergedAt: new Date('2026-06-10T12:00:00Z') }),
    ];
    const buckets = groupByWeek(prs);
    assert.equal(buckets[0].featuresCount, 2);
    assert.equal(buckets[0].bugsFixedCount, 0); // bugsFixed only counts fixed bug_fix
  });
});

// ── groupByDay ────────────────────────────────────────────────────────────────

describe('groupByDay', () => {
  test('PRs on same day go into one bucket', () => {
    const prs = [
      makePR({ id: 'a', githubMergedAt: new Date('2026-06-10T08:00:00Z') }),
      makePR({ id: 'b', githubMergedAt: new Date('2026-06-10T22:00:00Z') }),
    ];
    const buckets = groupByDay(prs);
    assert.equal(buckets.length, 1);
    assert.equal(buckets[0].prCount, 2);
  });

  test('PRs on different days go into separate buckets', () => {
    const prs = [
      makePR({ id: 'a', githubMergedAt: new Date('2026-06-10T10:00:00Z') }),
      makePR({ id: 'b', githubMergedAt: new Date('2026-06-11T10:00:00Z') }),
    ];
    const buckets = groupByDay(prs);
    assert.equal(buckets.length, 2);
  });

  test('buckets sorted newest first', () => {
    const prs = [
      makePR({ id: 'a', githubMergedAt: new Date('2026-06-10T10:00:00Z') }),
      makePR({ id: 'b', githubMergedAt: new Date('2026-06-11T10:00:00Z') }),
    ];
    const buckets = groupByDay(prs);
    // Jun 11 should be first
    assert.ok(buckets[0].key > buckets[1].key);
  });
});

// ── groupByMilestone ──────────────────────────────────────────────────────────

describe('groupByMilestone', () => {
  test('PRs with same milestoneId go into one bucket', () => {
    const prs = [
      makePR({ id: 'a', milestoneId: 'm1', milestoneTitle: 'v1.0' }),
      makePR({ id: 'b', milestoneId: 'm1', milestoneTitle: 'v1.0' }),
    ];
    const buckets = groupByMilestone(prs);
    assert.equal(buckets.length, 1);
    assert.equal(buckets[0].prCount, 2);
    assert.equal(buckets[0].label, 'v1.0');
  });

  test('PRs without milestone go into Unassigned bucket', () => {
    const prs = [
      makePR({ id: 'a', milestoneId: null }),
      makePR({ id: 'b', milestoneId: 'm1', milestoneTitle: 'v1.0' }),
    ];
    const buckets = groupByMilestone(prs);
    assert.equal(buckets.length, 2);
    const unassigned = buckets.find((b) => b.label === 'Unassigned');
    assert.ok(unassigned);
    assert.equal(unassigned!.prCount, 1);
  });
});

// ── groupPRs dispatcher ───────────────────────────────────────────────────────

describe('groupPRs', () => {
  const prs = [
    makePR({ id: 'a', githubMergedAt: new Date('2026-06-10T10:00:00Z'), milestoneId: 'm1', milestoneTitle: 'v1.0' }),
    makePR({ id: 'b', githubMergedAt: new Date('2026-06-17T10:00:00Z'), milestoneId: null }),
  ];

  test('week grouping returns week buckets', () => {
    const buckets = groupPRs(prs, 'week');
    assert.ok(buckets.every((b) => b.key.includes('W')));
  });

  test('day grouping returns day buckets', () => {
    const buckets = groupPRs(prs, 'day');
    assert.ok(buckets.every((b) => b.key.match(/^\d{4}-\d{2}-\d{2}$/)));
  });

  test('milestone grouping returns milestone buckets', () => {
    const buckets = groupPRs(prs, 'milestone');
    assert.ok(buckets.some((b) => b.label === 'v1.0'));
    assert.ok(buckets.some((b) => b.label === 'Unassigned'));
  });
});

// ── computeTimelineSummary ────────────────────────────────────────────────────

describe('computeTimelineSummary', () => {
  test('empty array returns zeros', () => {
    const s = computeTimelineSummary([]);
    assert.equal(s.totalPRs, 0);
    assert.equal(s.totalFeatures, 0);
    assert.equal(s.openBugs, 0);
  });

  test('counts features correctly', () => {
    const prs = [
      makePR({ id: 'a', classification: 'feature' }),
      makePR({ id: 'b', classification: 'feature' }),
      makePR({ id: 'c', classification: 'bug_fix' }),
    ];
    const s = computeTimelineSummary(prs);
    assert.equal(s.totalFeatures, 2);
    assert.equal(s.totalPRs, 3);
  });

  test('bugsFixed only counts bug_fix with state=fixed', () => {
    const prs = [
      makePR({ id: 'a', classification: 'bug_fix', bugState: 'fixed' }),
      makePR({ id: 'b', classification: 'bug_fix', bugState: 'known_issue' }),
      makePR({ id: 'c', classification: 'bug_fix', bugState: null }),
    ];
    const s = computeTimelineSummary(prs);
    assert.equal(s.totalBugsFixed, 1);
    assert.equal(s.openBugs, 1);
  });

  test('regression risks are counted', () => {
    const prs = [
      makePR({ id: 'a', bugState: 'regression_risk' }),
      makePR({ id: 'b', bugState: 'regression_risk' }),
    ];
    const s = computeTimelineSummary(prs);
    assert.equal(s.regressionRisks, 2);
  });

  test('security and migrations counted independently', () => {
    const prs = [
      makePR({ id: 'a', classification: 'security' }),
      makePR({ id: 'b', classification: 'migration' }),
      makePR({ id: 'c', classification: 'migration' }),
    ];
    const s = computeTimelineSummary(prs);
    assert.equal(s.totalSecurity, 1);
    assert.equal(s.totalMigrations, 2);
  });

  test('incidents counted', () => {
    const prs = [makePR({ id: 'a', classification: 'incident' })];
    assert.equal(computeTimelineSummary(prs).totalIncidents, 1);
  });
});
