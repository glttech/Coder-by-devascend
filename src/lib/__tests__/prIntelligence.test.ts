import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzePrImportance,
  summarizeTriage,
  compareByImportance,
  type PrIntelInput,
} from '../prIntelligence.js';

function analyze(partial: Partial<PrIntelInput>) {
  return analyzePrImportance({ title: 'untitled', ...partial });
}

// ── File-path importance rules ───────────────────────────────────────────────

describe('analyzePrImportance — file-path signals', () => {
  test('env/secrets file → critical signal + blocker', () => {
    const r = analyze({ filesChanged: ['apps/web/.env.production'] });
    assert.ok(r.signals.some((s) => s.category === 'env_secrets' && s.severity === 'critical'));
    assert.equal(r.priority, 'critical');
    assert.ok(r.mergeReadiness.blockers.some((b) => /env\/secrets/i.test(b)));
    assert.equal(r.mergeReadiness.ready, false);
  });

  test('prisma migration file → migration high signal', () => {
    const r = analyze({ filesChanged: ['prisma/migrations/20260101_init/migration.sql'] });
    const sig = r.signals.find((s) => s.category === 'migration');
    assert.ok(sig);
    assert.equal(sig?.severity, 'high');
    assert.ok(r.mergeReadiness.warnings.some((w) => /migration/i.test(w)));
  });

  test('auth path → auth_security high signal', () => {
    const r = analyze({ filesChanged: ['src/lib/auth/session.ts'] });
    assert.ok(r.signals.some((s) => s.category === 'auth_security' && s.severity === 'high'));
  });

  test('rbac path → rbac_permission signal', () => {
    const r = analyze({ filesChanged: ['src/lib/rbac.ts'] });
    assert.ok(r.signals.some((s) => s.category === 'rbac_permission'));
  });

  test('Dockerfile / workflow → infra_deploy signal', () => {
    const r = analyze({ filesChanged: ['Dockerfile', '.github/workflows/ci.yml'] });
    assert.ok(r.signals.some((s) => s.category === 'infra_deploy'));
  });

  test('billing path → billing signal', () => {
    const r = analyze({ filesChanged: ['src/app/api/billing/stripe.ts'] });
    assert.ok(r.signals.some((s) => s.category === 'billing'));
  });

  test('api route → api_contract signal', () => {
    const r = analyze({ filesChanged: ['src/app/api/projects/route.ts'] });
    assert.ok(r.signals.some((s) => s.category === 'api_contract'));
  });

  test('dependency manifest → dependency signal', () => {
    const r = analyze({ filesChanged: ['package.json', 'pnpm-lock.yaml'] });
    assert.ok(r.signals.some((s) => s.category === 'dependency'));
  });

  test('evidence names a concrete file', () => {
    const r = analyze({ filesChanged: ['prisma/migrations/x/migration.sql'] });
    const sig = r.signals.find((s) => s.category === 'migration');
    assert.match(sig!.evidence, /migration\.sql/);
  });
});

// ── Text fallbacks when no file list ─────────────────────────────────────────

describe('analyzePrImportance — text fallbacks', () => {
  test('migration mentioned in title with no files', () => {
    const r = analyze({ title: 'feat: add database migration for users', filesChanged: [] });
    assert.ok(r.signals.some((s) => s.category === 'migration'));
  });

  test('security in body fires when no files present', () => {
    const r = analyze({ title: 'patch', body: 'fixes an authentication bypass vulnerability', filesChanged: [] });
    assert.ok(r.signals.some((s) => s.category === 'auth_security'));
  });

  test('file signal takes precedence — no duplicate category from text', () => {
    const r = analyze({
      title: 'migration work',
      filesChanged: ['prisma/migrations/a/migration.sql'],
    });
    const migrationSignals = r.signals.filter((s) => s.category === 'migration');
    assert.equal(migrationSignals.length, 1);
  });
});

// ── Classification-driven signals ────────────────────────────────────────────

describe('analyzePrImportance — classification', () => {
  test('classification=migration adds migration signal when files absent', () => {
    const r = analyze({ title: 'chore', classification: 'migration', filesChanged: [] });
    assert.ok(r.signals.some((s) => s.key === 'classified-migration'));
  });

  test('classification=security adds auth_security signal', () => {
    const r = analyze({ title: 'chore', classification: 'security', filesChanged: [] });
    assert.ok(r.signals.some((s) => s.key === 'classified-security'));
  });
});

// ── Test removal (honest detection) ──────────────────────────────────────────

describe('analyzePrImportance — test removal', () => {
  test('title says "remove tests" + test files → high', () => {
    const r = analyze({
      title: 'remove flaky tests',
      filesChanged: ['src/lib/__tests__/foo.test.ts'],
    });
    const sig = r.signals.find((s) => s.key === 'test-removal');
    assert.ok(sig);
    assert.equal(sig?.severity, 'high');
  });

  test('does NOT flag removal when author never says so', () => {
    const r = analyze({
      title: 'add new feature',
      filesChanged: ['src/lib/__tests__/foo.test.ts'],
    });
    assert.ok(!r.signals.some((s) => s.key === 'test-removal'));
  });
});

// ── Large diff ───────────────────────────────────────────────────────────────

describe('analyzePrImportance — diff size', () => {
  test('>=40 files → high large-diff signal', () => {
    const r = analyze({ filesChangedCount: 55 });
    assert.ok(r.signals.some((s) => s.key === 'large-diff-high'));
  });

  test('18–39 files → medium large-diff signal', () => {
    const r = analyze({ filesChangedCount: 20 });
    assert.ok(r.signals.some((s) => s.key === 'large-diff-medium'));
  });

  test('small diff → no large-diff signal', () => {
    const r = analyze({ filesChangedCount: 3 });
    assert.ok(!r.signals.some((s) => s.category === 'large_diff'));
  });
});

// ── CI signals & blocking ────────────────────────────────────────────────────

describe('analyzePrImportance — CI', () => {
  test('CI failure → critical, blocked, not ready', () => {
    const r = analyze({ ciStatus: 'failure', state: 'open' });
    assert.ok(r.signals.some((s) => s.key === 'ci-failure'));
    assert.equal(r.triage, 'blocked');
    assert.equal(r.mergeReadiness.ready, false);
    assert.ok(r.mergeReadiness.blockers.some((b) => /CI is failing/i.test(b)));
  });

  test('CI pending → warning, not ready', () => {
    const r = analyze({ ciStatus: 'pending', state: 'open' });
    assert.equal(r.mergeReadiness.ready, false);
    assert.ok(r.mergeReadiness.warnings.some((w) => /not green/i.test(w)));
  });

  test('CI success on clean small PR → ready + safe', () => {
    const r = analyze({ ciStatus: 'success', state: 'open', filesChanged: ['README.md'] });
    assert.equal(r.triage, 'safe');
    assert.equal(r.mergeReadiness.ready, true);
    assert.equal(r.needsReview, false);
  });
});

// ── Triage & priority integration ────────────────────────────────────────────

describe('analyzePrImportance — triage buckets', () => {
  test('docs-only PR with green CI is safe', () => {
    const r = analyze({ title: 'docs: update readme', filesChanged: ['README.md'], ciStatus: 'success', state: 'open' });
    assert.equal(r.triage, 'safe');
    assert.equal(r.priority, 'low');
  });

  test('auth change with green CI needs review (not blocked)', () => {
    const r = analyze({ filesChanged: ['src/lib/auth/login.ts'], ciStatus: 'success', state: 'open' });
    assert.equal(r.triage, 'needs_review');
    assert.equal(r.needsReview, true);
  });

  test('env change is blocked even with green CI', () => {
    const r = analyze({ filesChanged: ['.env'], ciStatus: 'success', state: 'open' });
    assert.equal(r.triage, 'blocked');
  });

  test('score is capped at 100', () => {
    const r = analyze({
      filesChanged: ['.env', 'prisma/migrations/x/migration.sql', 'src/lib/auth/x.ts', 'Dockerfile', 'package.json'],
      ciStatus: 'failure',
      filesChangedCount: 60,
    });
    assert.ok(r.importanceScore <= 100);
    assert.equal(r.priority, 'critical');
  });
});

// ── List helpers ─────────────────────────────────────────────────────────────

describe('summarizeTriage & compareByImportance', () => {
  test('summarizeTriage counts buckets', () => {
    const items = [
      analyze({ filesChanged: ['.env'], ciStatus: 'success' }), // blocked
      analyze({ filesChanged: ['src/lib/auth/x.ts'], ciStatus: 'success' }), // needs_review
      analyze({ filesChanged: ['README.md'], ciStatus: 'success' }), // safe
      analyze({ filesChanged: ['docs/x.md'], ciStatus: 'success' }), // safe
    ];
    const c = summarizeTriage(items);
    assert.equal(c.total, 4);
    assert.equal(c.blocked, 1);
    assert.equal(c.needsReview, 1);
    assert.equal(c.safe, 2);
  });

  test('compareByImportance sorts critical before low', () => {
    const critical = analyze({ ciStatus: 'failure' });
    const low = analyze({ filesChanged: ['README.md'], ciStatus: 'success' });
    const sorted = [low, critical].sort(compareByImportance);
    assert.equal(sorted[0].priority, 'critical');
  });
});

// ── requiredDecision & nextAction ────────────────────────────────────────────

describe('analyzePrImportance — requiredDecision & nextAction', () => {
  test('CI failure → decision says block, nextAction mentions CI', () => {
    const r = analyze({ ciStatus: 'failure', state: 'open' });
    assert.match(r.requiredDecision, /block|failing/i);
    assert.match(r.nextAction, /CI/i);
  });

  test('env/secrets file → decision requires explicit approval', () => {
    const r = analyze({ filesChanged: ['.env.production'], ciStatus: 'success', state: 'open' });
    assert.match(r.requiredDecision, /approval|secrets/i);
    assert.match(r.nextAction, /audit|secrets/i);
  });

  test('migration file needs review → decision mentions migration', () => {
    const r = analyze({ filesChanged: ['prisma/migrations/20260101/migration.sql'], ciStatus: 'success', state: 'open' });
    assert.match(r.requiredDecision, /migration/i);
    assert.match(r.nextAction, /migration|backward|dev/i);
  });

  test('auth path needs review → decision mentions security', () => {
    const r = analyze({ filesChanged: ['src/lib/auth/login.ts'], ciStatus: 'success', state: 'open' });
    assert.match(r.requiredDecision, /security|review/i);
    assert.ok(r.nextAction.length > 10);
  });

  test('billing path needs review → decision mentions billing', () => {
    const r = analyze({ filesChanged: ['src/app/billing/stripe.ts'], ciStatus: 'success', state: 'open' });
    assert.match(r.requiredDecision, /billing|careful/i);
  });

  test('infra change needs review → decision mentions infra or Ops', () => {
    const r = analyze({ filesChanged: ['Dockerfile'], ciStatus: 'success', state: 'open' });
    assert.match(r.requiredDecision, /infrastructure|Ops/i);
  });

  test('CI pending → decision says waiting on CI', () => {
    const r = analyze({ filesChanged: ['README.md'], ciStatus: 'pending', state: 'open' });
    assert.match(r.requiredDecision, /waiting|CI/i);
  });

  test('clean PR with CI success → decision says ready', () => {
    const r = analyze({ filesChanged: ['README.md'], ciStatus: 'success', state: 'open' });
    assert.match(r.requiredDecision, /ready|merge/i);
    assert.match(r.nextAction, /merge/i);
  });

  test('requiredDecision and nextAction are always non-empty strings', () => {
    const cases: Partial<PrIntelInput>[] = [
      {},
      { ciStatus: 'failure' },
      { ciStatus: 'success', filesChanged: ['.env'] },
      { ciStatus: 'success', filesChanged: ['README.md'] },
      { ciStatus: 'pending', filesChanged: ['src/app/api/route.ts'] },
    ];
    for (const c of cases) {
      const r = analyze(c);
      assert.ok(r.requiredDecision.length > 0, `requiredDecision empty for ${JSON.stringify(c)}`);
      assert.ok(r.nextAction.length > 0, `nextAction empty for ${JSON.stringify(c)}`);
    }
  });
});

// ── Robustness ───────────────────────────────────────────────────────────────

describe('analyzePrImportance — robustness', () => {
  test('empty input does not throw and is low/safe', () => {
    const r = analyzePrImportance({ title: '' });
    assert.equal(r.signals.length, 0);
    assert.equal(r.priority, 'low');
    assert.equal(r.triage, 'safe');
  });

  test('merged PR is never "ready"', () => {
    const r = analyze({ filesChanged: ['README.md'], ciStatus: 'success', merged: true, state: 'merged' });
    assert.equal(r.mergeReadiness.ready, false);
  });
});
