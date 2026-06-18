import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildReportSections,
  buildRisks,
  buildPending,
  buildReleaseReport,
} from '../releaseReport.js';
import type { TimelinePR } from '../buildTimeline.js';

// ── helpers ───────────────────────────────────────────────────────────────────

let seq = 1;
function makePR(overrides: Partial<TimelinePR> = {}): TimelinePR {
  const n = seq++;
  return {
    id: `pr-${n}`,
    prNumber: n,
    title: `PR ${n}`,
    author: 'dev',
    prUrl: null,
    state: 'closed',
    merged: true,
    ciStatus: 'success',
    classification: 'unclassified',
    bugState: null,
    labels: [],
    filesChangedCount: null,
    githubMergedAt: new Date('2026-06-01'),
    githubCreatedAt: new Date('2026-05-30'),
    milestoneId: null,
    ...overrides,
  };
}

// ── buildReportSections ───────────────────────────────────────────────────────

describe('buildReportSections', () => {
  test('empty input returns all empty sections', () => {
    const s = buildReportSections([]);
    assert.equal(s.features.length, 0);
    assert.equal(s.bugFixes.length, 0);
    assert.equal(s.security.length, 0);
    assert.equal(s.migrations.length, 0);
    assert.equal(s.deployments.length, 0);
    assert.equal(s.incidents.length, 0);
    assert.equal(s.other.length, 0);
  });

  test('feature PR goes to features', () => {
    const s = buildReportSections([makePR({ classification: 'feature' })]);
    assert.equal(s.features.length, 1);
    assert.equal(s.other.length, 0);
  });

  test('bug_fix PR goes to bugFixes', () => {
    const s = buildReportSections([makePR({ classification: 'bug_fix' })]);
    assert.equal(s.bugFixes.length, 1);
  });

  test('security PR goes to security', () => {
    const s = buildReportSections([makePR({ classification: 'security' })]);
    assert.equal(s.security.length, 1);
  });

  test('migration PR goes to migrations', () => {
    const s = buildReportSections([makePR({ classification: 'migration' })]);
    assert.equal(s.migrations.length, 1);
  });

  test('deployment PR goes to deployments', () => {
    const s = buildReportSections([makePR({ classification: 'deployment' })]);
    assert.equal(s.deployments.length, 1);
  });

  test('incident PR goes to incidents', () => {
    const s = buildReportSections([makePR({ classification: 'incident' })]);
    assert.equal(s.incidents.length, 1);
  });

  test('chore/test/docs/rollback go to other', () => {
    for (const c of ['chore', 'test', 'docs', 'rollback', 'unclassified'] as const) {
      const s = buildReportSections([makePR({ classification: c })]);
      assert.equal(s.other.length, 1, `expected other for classification=${c}`);
    }
  });

  test('multiple PRs are distributed correctly', () => {
    const prs = [
      makePR({ classification: 'feature' }),
      makePR({ classification: 'feature' }),
      makePR({ classification: 'bug_fix' }),
      makePR({ classification: 'security' }),
    ];
    const s = buildReportSections(prs);
    assert.equal(s.features.length, 2);
    assert.equal(s.bugFixes.length, 1);
    assert.equal(s.security.length, 1);
  });
});

// ── buildRisks ────────────────────────────────────────────────────────────────

describe('buildRisks', () => {
  test('no risks for normal merged feature PRs', () => {
    const risks = buildRisks([makePR({ classification: 'feature' })]);
    assert.equal(risks.length, 0);
  });

  test('regression_risk bugState → high severity risk', () => {
    const risks = buildRisks([makePR({ bugState: 'regression_risk' })]);
    assert.equal(risks.length, 1);
    assert.equal(risks[0].severity, 'high');
    assert.match(risks[0].reason, /regression/i);
  });

  test('incident classification → medium severity risk', () => {
    const risks = buildRisks([makePR({ classification: 'incident' })]);
    assert.equal(risks.length, 1);
    assert.equal(risks[0].severity, 'medium');
  });

  test('security classification → medium severity risk', () => {
    const risks = buildRisks([makePR({ classification: 'security' })]);
    assert.equal(risks.length, 1);
    assert.equal(risks[0].severity, 'medium');
    assert.match(risks[0].reason, /security/i);
  });

  test('migration classification → low severity risk', () => {
    const risks = buildRisks([makePR({ classification: 'migration' })]);
    assert.equal(risks.length, 1);
    assert.equal(risks[0].severity, 'low');
    assert.match(risks[0].reason, /migration/i);
  });

  test('regression_risk takes priority over other signals (deduplication)', () => {
    // A PR with bugState=regression_risk should produce exactly one risk entry
    const risks = buildRisks([makePR({ classification: 'bug_fix', bugState: 'regression_risk' })]);
    assert.equal(risks.length, 1);
    assert.equal(risks[0].severity, 'high');
  });

  test('risk items include prNumber and prTitle', () => {
    const pr = makePR({ classification: 'security' });
    const risks = buildRisks([pr]);
    assert.equal(risks[0].prNumber, pr.prNumber);
    assert.equal(risks[0].prTitle, pr.title);
  });

  test('empty input returns no risks', () => {
    assert.equal(buildRisks([]).length, 0);
  });
});

// ── buildPending ──────────────────────────────────────────────────────────────

describe('buildPending', () => {
  test('no pending for clean merged feature PRs', () => {
    const p = buildPending([makePR({ classification: 'feature' })]);
    assert.equal(p.length, 0);
  });

  test('known_issue → open_bug pending', () => {
    const p = buildPending([makePR({ bugState: 'known_issue' })]);
    assert.equal(p.length, 1);
    assert.equal(p[0].type, 'open_bug');
  });

  test('regression_risk → regression_risk pending', () => {
    const p = buildPending([makePR({ bugState: 'regression_risk' })]);
    assert.equal(p.length, 1);
    assert.equal(p[0].type, 'regression_risk');
  });

  test('needs_retest → needs_retest pending', () => {
    const p = buildPending([makePR({ bugState: 'needs_retest' })]);
    assert.equal(p.length, 1);
    assert.equal(p[0].type, 'needs_retest');
  });

  test('migration with non-success CI → migration_unverified', () => {
    const p = buildPending([makePR({ classification: 'migration', ciStatus: 'failure' })]);
    assert.equal(p.length, 1);
    assert.equal(p[0].type, 'migration_unverified');
  });

  test('migration with success CI → not pending', () => {
    const p = buildPending([makePR({ classification: 'migration', ciStatus: 'success' })]);
    assert.equal(p.length, 0);
  });

  test('empty input returns empty', () => {
    assert.equal(buildPending([]).length, 0);
  });
});

// ── buildReleaseReport ────────────────────────────────────────────────────────

describe('buildReleaseReport', () => {
  test('returns a report with generatedAt, filters, summary, sections, risks, pending', () => {
    const report = buildReleaseReport([], {});
    assert.ok(report.generatedAt);
    assert.ok('filters' in report);
    assert.ok('summary' in report);
    assert.ok('sections' in report);
    assert.ok(Array.isArray(report.risks));
    assert.ok(Array.isArray(report.pending));
  });

  test('summary counts are correct for mixed PRs', () => {
    const prs = [
      makePR({ classification: 'feature' }),
      makePR({ classification: 'feature' }),
      makePR({ classification: 'bug_fix', bugState: 'fixed' }),
      makePR({ classification: 'security' }),
      makePR({ classification: 'migration' }),
    ];
    const report = buildReleaseReport(prs, {});
    assert.equal(report.summary.totalPRs, 5);
    assert.equal(report.summary.features, 2);
    assert.equal(report.summary.securityChanges, 1);
    assert.equal(report.summary.migrations, 1);
  });

  test('filters are preserved in the report', () => {
    const since = new Date('2026-01-01');
    const report = buildReleaseReport([], { projectId: 'proj-1', since });
    assert.equal(report.filters.projectId, 'proj-1');
    assert.deepEqual(report.filters.since, since);
  });

  test('generatedAt is a valid ISO timestamp', () => {
    const report = buildReleaseReport([], {});
    assert.ok(!isNaN(new Date(report.generatedAt).getTime()));
  });
});
