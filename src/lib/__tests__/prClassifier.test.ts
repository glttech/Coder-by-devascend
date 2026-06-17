import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { classifyPR, detectBugState, buildClassificationFields } from '../prClassifier.js';

// ── classifyPR: label-based (highest priority) ───────────────────────────────

describe('classifyPR — label priority', () => {
  test('bug label → bug_fix from auto_label', () => {
    const r = classifyPR({ title: 'some change', body: null, labels: ['bug'], filesChanged: [] });
    assert.equal(r.classification, 'bug_fix');
    assert.equal(r.classificationSource, 'auto_label');
    assert.equal(r.confidence, 'high');
  });

  test('security label → security', () => {
    const r = classifyPR({ title: 'update handler', body: null, labels: ['security'], filesChanged: [] });
    assert.equal(r.classification, 'security');
    assert.equal(r.classificationSource, 'auto_label');
  });

  test('dependencies label → chore', () => {
    const r = classifyPR({ title: 'bump deps', body: null, labels: ['dependencies'], filesChanged: [] });
    assert.equal(r.classification, 'chore');
    assert.equal(r.classificationSource, 'auto_label');
  });

  test('documentation label → docs', () => {
    const r = classifyPR({ title: 'update readme', body: null, labels: ['documentation'], filesChanged: [] });
    assert.equal(r.classification, 'docs');
    assert.equal(r.classificationSource, 'auto_label');
  });

  test('feature label → feature', () => {
    const r = classifyPR({ title: 'something new', body: null, labels: ['feature'], filesChanged: [] });
    assert.equal(r.classification, 'feature');
  });

  test('label takes priority over title prefix', () => {
    const r = classifyPR({ title: 'feat: add thing', body: null, labels: ['bug'], filesChanged: [] });
    assert.equal(r.classification, 'bug_fix');
    assert.equal(r.classificationSource, 'auto_label');
  });
});

// ── classifyPR: title prefix (conventional commits) ──────────────────────────

describe('classifyPR — title prefix', () => {
  test('fix: prefix → bug_fix high confidence', () => {
    const r = classifyPR({ title: 'fix: null pointer in task loader', body: null, labels: [], filesChanged: [] });
    assert.equal(r.classification, 'bug_fix');
    assert.equal(r.confidence, 'high');
  });

  test('feat: prefix → feature high confidence', () => {
    const r = classifyPR({ title: 'feat: add timeline view', body: null, labels: [], filesChanged: [] });
    assert.equal(r.classification, 'feature');
    assert.equal(r.confidence, 'high');
  });

  test('feat(scope)!: prefix → feature', () => {
    const r = classifyPR({ title: 'feat(tasks)!: rewrite task state machine', body: null, labels: [], filesChanged: [] });
    assert.equal(r.classification, 'feature');
    assert.equal(r.confidence, 'high');
  });

  test('chore: prefix → chore', () => {
    const r = classifyPR({ title: 'chore: update prettier config', body: null, labels: [], filesChanged: [] });
    assert.equal(r.classification, 'chore');
  });

  test('docs: prefix → docs', () => {
    const r = classifyPR({ title: 'docs: improve setup guide', body: null, labels: [], filesChanged: [] });
    assert.equal(r.classification, 'docs');
  });

  test('test: prefix → test', () => {
    const r = classifyPR({ title: 'test: add coverage for rbac', body: null, labels: [], filesChanged: [] });
    assert.equal(r.classification, 'test');
  });

  test('revert: prefix → rollback', () => {
    const r = classifyPR({ title: 'revert: undo auth changes', body: null, labels: [], filesChanged: [] });
    assert.equal(r.classification, 'rollback');
  });

  test('security: prefix → security', () => {
    const r = classifyPR({ title: 'security: patch XSS in share link', body: null, labels: [], filesChanged: [] });
    assert.equal(r.classification, 'security');
  });

  test('keyword "migration" in title → migration medium confidence', () => {
    const r = classifyPR({ title: 'add user table migration', body: null, labels: [], filesChanged: [] });
    assert.equal(r.classification, 'migration');
    assert.equal(r.confidence, 'medium');
  });

  test('keyword "deployment" in title → deployment', () => {
    const r = classifyPR({ title: 'update deployment config', body: null, labels: [], filesChanged: [] });
    assert.equal(r.classification, 'deployment');
  });

  test('keyword "incident" in title → incident', () => {
    const r = classifyPR({ title: 'incident: DB connection exhaustion', body: null, labels: [], filesChanged: [] });
    assert.equal(r.classification, 'incident');
  });
});

// ── classifyPR: body keywords ─────────────────────────────────────────────────

describe('classifyPR — body keywords', () => {
  test('body mentions "ALTER TABLE" → migration', () => {
    const r = classifyPR({
      title: 'schema update',
      body: 'This PR runs ALTER TABLE users ADD COLUMN profile_image TEXT.',
      labels: [],
      filesChanged: [],
    });
    assert.equal(r.classification, 'migration');
  });

  test('body mentions "CVE-" → security', () => {
    const r = classifyPR({
      title: 'update session handler',
      body: 'Fixes CVE-2024-12345 in the session handler.',
      labels: [],
      filesChanged: [],
    });
    assert.equal(r.classification, 'security');
  });

  test('body "fixes a bug in" → bug_fix', () => {
    const r = classifyPR({
      title: 'task loader update',
      body: 'This PR fixes a bug in the task loader causing null reference errors.',
      labels: [],
      filesChanged: [],
    });
    assert.equal(r.classification, 'bug_fix');
  });
});

// ── classifyPR: file path signals ────────────────────────────────────────────

describe('classifyPR — file path signals', () => {
  test('prisma/migrations file → migration', () => {
    const r = classifyPR({
      title: 'db update',
      body: null,
      labels: [],
      filesChanged: ['prisma/migrations/20260617_add_users/migration.sql'],
    });
    assert.equal(r.classification, 'migration');
    assert.equal(r.classificationSource, 'auto_files');
  });

  test('.test.ts file → test', () => {
    const r = classifyPR({
      title: 'add coverage',
      body: null,
      labels: [],
      filesChanged: ['src/lib/__tests__/foo.test.ts'],
    });
    assert.equal(r.classification, 'test');
    assert.equal(r.classificationSource, 'auto_files');
  });

  test('Dockerfile → deployment', () => {
    const r = classifyPR({
      title: 'update container',
      body: null,
      labels: [],
      filesChanged: ['Dockerfile'],
    });
    assert.equal(r.classification, 'deployment');
  });

  test('.md file → docs', () => {
    const r = classifyPR({
      title: 'update guide',
      body: null,
      labels: [],
      filesChanged: ['README.md'],
    });
    assert.equal(r.classification, 'docs');
  });
});

// ── detectBugState ───────────────────────────────────────────────────────────

describe('detectBugState', () => {
  test('merged bug_fix with success CI → fixed', () => {
    const s = detectBugState('bug_fix', 'success', [], 'fix login bug', 'merged');
    assert.equal(s, 'fixed');
  });

  test('merged bug_fix with null CI → fixed (no CI data)', () => {
    const s = detectBugState('bug_fix', null, [], 'fix task crash', 'merged');
    assert.equal(s, 'fixed');
  });

  test('merged bug_fix with failure CI → regression_risk', () => {
    const s = detectBugState('bug_fix', 'failure', [], 'fix thing', 'merged');
    assert.equal(s, 'regression_risk');
  });

  test('open bug_fix → known_issue', () => {
    const s = detectBugState('bug_fix', null, [], 'fix null ref', 'open');
    assert.equal(s, 'known_issue');
  });

  test('known-issue label → known_issue regardless of state', () => {
    const s = detectBugState('feature', null, ['known-issue'], 'add thing', 'merged');
    assert.equal(s, 'known_issue');
  });

  test('regression label → regression_risk', () => {
    const s = detectBugState('bug_fix', 'success', ['regression'], 'fix crash', 'merged');
    assert.equal(s, 'regression_risk');
  });

  test('needs-retest label → needs_retest', () => {
    const s = detectBugState('bug_fix', null, ['needs-retest'], 'fix auth', 'merged');
    assert.equal(s, 'needs_retest');
  });

  test('feature classification → null bug state', () => {
    const s = detectBugState('feature', 'success', [], 'add dashboard', 'merged');
    assert.equal(s, null);
  });

  test('regression keyword in title → regression_risk', () => {
    const s = detectBugState('chore', null, [], 'fix regression in auth flow', 'open');
    assert.equal(s, 'regression_risk');
  });

  test('merged incident with success → fixed', () => {
    const s = detectBugState('incident', 'success', [], 'incident: db outage fix', 'merged');
    assert.equal(s, 'fixed');
  });
});

// ── buildClassificationFields ─────────────────────────────────────────────────

describe('buildClassificationFields', () => {
  test('returns all three fields', () => {
    const result = buildClassificationFields({
      title: 'fix: broken pagination',
      body: null,
      labels: [],
      filesChanged: [],
      state: 'merged',
      ciStatus: 'success',
    });
    assert.equal(result.classification, 'bug_fix');
    assert.equal(result.classificationSource, 'auto_title');
    assert.equal(result.bugState, 'fixed');
  });

  test('feature PR has null bugState', () => {
    const result = buildClassificationFields({
      title: 'feat: add search',
      body: null,
      labels: [],
      filesChanged: [],
      state: 'merged',
      ciStatus: 'success',
    });
    assert.equal(result.classification, 'feature');
    assert.equal(result.bugState, null);
  });

  test('security label override title', () => {
    const result = buildClassificationFields({
      title: 'feat: add login',
      body: null,
      labels: ['security'],
      filesChanged: [],
      state: 'open',
      ciStatus: null,
    });
    assert.equal(result.classification, 'security');
    assert.equal(result.classificationSource, 'auto_label');
  });
});
