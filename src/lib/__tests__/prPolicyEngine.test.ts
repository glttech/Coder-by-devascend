import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluatePrPolicy,
  summarizePolicyVerdicts,
  type PrPolicyInput,
} from '../prPolicyEngine.js';

function evaluate(partial: Partial<PrPolicyInput>) {
  return evaluatePrPolicy({ title: 'untitled', ...partial });
}

// ── Env / Secrets (blocked) ───────────────────────────────────────────────────

describe('Policy: env/secrets', () => {
  test('env file → blocked verdict + CTO approver', () => {
    const r = evaluate({ filesChanged: ['.env.production'], ciStatus: 'success', state: 'open' });
    assert.equal(r.verdict, 'blocked');
    assert.equal(r.requiredApprover, 'cto');
    assert.ok(r.violatedPolicies.some((v) => v.category === 'env_secrets'));
    assert.equal(r.mergeRecommendation, 'do_not_merge');
  });

  test('secrets/ directory → blocked', () => {
    const r = evaluate({ filesChanged: ['config/secrets/api.key'], ciStatus: 'success', state: 'open' });
    assert.equal(r.verdict, 'blocked');
  });

  test('credentials.json → blocked', () => {
    const r = evaluate({ filesChanged: ['credentials.json'], ciStatus: 'success', state: 'open' });
    assert.equal(r.verdict, 'blocked');
  });
});

// ── CI Failure (blocked) ──────────────────────────────────────────────────────

describe('Policy: CI failure', () => {
  test('CI failure → blocked', () => {
    const r = evaluate({ ciStatus: 'failure', filesChanged: ['README.md'], state: 'open' });
    assert.equal(r.verdict, 'blocked');
    assert.ok(r.violatedPolicies.some((v) => v.category === 'ci_failure'));
  });

  test('CI failure + env file → blocked + policy score high', () => {
    const r = evaluate({ ciStatus: 'failure', filesChanged: ['.env'], state: 'open' });
    assert.equal(r.verdict, 'blocked');
    assert.ok(r.policyScore > 50);
    assert.ok(r.violatedPolicies.length >= 2);
  });

  test('CI success → no CI violation', () => {
    const r = evaluate({ ciStatus: 'success', filesChanged: ['README.md'], state: 'open' });
    assert.ok(!r.violatedPolicies.some((v) => v.category === 'ci_failure'));
  });

  test('CI pending → no CI violation (only a warning, not block)', () => {
    const r = evaluate({ ciStatus: 'pending', filesChanged: ['README.md'], state: 'open' });
    assert.ok(!r.violatedPolicies.some((v) => v.category === 'ci_failure'));
  });
});

// ── Migration (review_required) ───────────────────────────────────────────────

describe('Policy: database migration', () => {
  test('prisma migration file → review_required + senior_engineer approver', () => {
    const r = evaluate({ filesChanged: ['prisma/migrations/20260101/migration.sql'], ciStatus: 'success', state: 'open' });
    const v = r.violatedPolicies.find((x) => x.category === 'migration');
    assert.ok(v);
    assert.equal(v?.verdict, 'review_required');
    assert.equal(r.requiredApprover, 'senior_engineer');
    assert.equal(r.mergeRecommendation, 'review_first');
  });

  test('schema.prisma touched → migration policy fires', () => {
    const r = evaluate({ filesChanged: ['prisma/schema.prisma'], ciStatus: 'success', state: 'open' });
    assert.ok(r.violatedPolicies.some((v) => v.category === 'migration'));
  });
});

// ── Auth / Security (review_required) ────────────────────────────────────────

describe('Policy: auth/security', () => {
  test('auth path → review_required + security_reviewer', () => {
    const r = evaluate({ filesChanged: ['src/lib/auth/session.ts'], ciStatus: 'success', state: 'open' });
    const v = r.violatedPolicies.find((x) => x.category === 'auth_security');
    assert.ok(v);
    assert.equal(v?.verdict, 'review_required');
    assert.ok(['security_reviewer', 'senior_engineer', 'cto'].includes(r.requiredApprover));
  });

  test('middleware.ts → auth_security fires', () => {
    const r = evaluate({ filesChanged: ['src/middleware.ts'], ciStatus: 'success', state: 'open' });
    assert.ok(r.violatedPolicies.some((v) => v.category === 'auth_security'));
  });
});

// ── RBAC / Permissions (review_required) ──────────────────────────────────────

describe('Policy: RBAC/permissions', () => {
  test('rbac.ts → rbac_permission policy fires', () => {
    const r = evaluate({ filesChanged: ['src/lib/rbac.ts'], ciStatus: 'success', state: 'open' });
    assert.ok(r.violatedPolicies.some((v) => v.category === 'rbac_permission'));
    assert.equal(r.verdict, 'review_required');
  });
});

// ── Infra / Deploy (review_required) ─────────────────────────────────────────

describe('Policy: infra/deploy', () => {
  test('Dockerfile → review_required', () => {
    const r = evaluate({ filesChanged: ['Dockerfile'], ciStatus: 'success', state: 'open' });
    assert.ok(r.violatedPolicies.some((v) => v.category === 'infra_deploy'));
    assert.equal(r.verdict, 'review_required');
  });

  test('GitHub Actions workflow → infra_deploy', () => {
    const r = evaluate({ filesChanged: ['.github/workflows/ci.yml'], ciStatus: 'success', state: 'open' });
    assert.ok(r.violatedPolicies.some((v) => v.category === 'infra_deploy'));
  });
});

// ── Billing (review_required) ─────────────────────────────────────────────────

describe('Policy: billing', () => {
  test('billing path → review_required', () => {
    const r = evaluate({ filesChanged: ['src/app/api/billing/stripe.ts'], ciStatus: 'success', state: 'open' });
    assert.ok(r.violatedPolicies.some((v) => v.category === 'billing'));
    assert.equal(r.verdict, 'review_required');
  });
});

// ── API Contract (review_required) ────────────────────────────────────────────

describe('Policy: API contract', () => {
  test('API route file → review_required', () => {
    const r = evaluate({ filesChanged: ['src/app/api/projects/route.ts'], ciStatus: 'success', state: 'open' });
    assert.ok(r.violatedPolicies.some((v) => v.category === 'api_contract'));
    assert.equal(r.verdict, 'review_required');
  });
});

// ── Dependency change ─────────────────────────────────────────────────────────

describe('Policy: dependencies', () => {
  test('package.json change → dependency review', () => {
    const r = evaluate({ filesChanged: ['package.json'], ciStatus: 'success', state: 'open' });
    assert.ok(r.violatedPolicies.some((v) => v.category === 'dependency'));
  });

  test('pnpm-lock.yaml → dependency review', () => {
    const r = evaluate({ filesChanged: ['pnpm-lock.yaml'], ciStatus: 'success', state: 'open' });
    assert.ok(r.violatedPolicies.some((v) => v.category === 'dependency'));
  });
});

// ── Large diff ────────────────────────────────────────────────────────────────

describe('Policy: large diff', () => {
  test('40+ files → large_diff review', () => {
    const r = evaluate({ filesChangedCount: 45, ciStatus: 'success', state: 'open' });
    assert.ok(r.violatedPolicies.some((v) => v.category === 'large_diff'));
  });

  test('small diff → no large_diff violation', () => {
    const r = evaluate({ filesChangedCount: 3, ciStatus: 'success', state: 'open' });
    assert.ok(!r.violatedPolicies.some((v) => v.category === 'large_diff'));
  });
});

// ── Test deletion ─────────────────────────────────────────────────────────────

describe('Policy: test deletion', () => {
  test('title says remove tests → test_coverage violation', () => {
    const r = evaluate({ title: 'remove flaky tests', filesChanged: ['src/lib/__tests__/foo.test.ts'], ciStatus: 'success', state: 'open' });
    assert.ok(r.violatedPolicies.some((v) => v.category === 'test_coverage'));
  });

  test('normal title → no test_coverage violation', () => {
    const r = evaluate({ title: 'add feature', filesChanged: ['src/lib/__tests__/foo.test.ts'], ciStatus: 'success', state: 'open' });
    assert.ok(!r.violatedPolicies.some((v) => v.category === 'test_coverage'));
  });
});

// ── Unknown file list ─────────────────────────────────────────────────────────

describe('Policy: unknown file list', () => {
  test('no files and no count → unknown_files + low confidence', () => {
    const r = evaluate({ title: 'some change', filesChanged: [], filesChangedCount: null });
    assert.equal(r.confidenceLevel, 'low');
    assert.ok(r.violatedPolicies.some((v) => v.category === 'unknown_files'));
    assert.equal(r.verdict, 'review_required');
  });

  test('files present → confidence is not low from file absence', () => {
    const r = evaluate({ filesChanged: ['README.md'], ciStatus: 'success', state: 'open' });
    assert.notEqual(r.confidenceLevel, 'low');
  });
});

// ── Safe / pass cases ─────────────────────────────────────────────────────────

describe('Policy: safe PRs', () => {
  test('docs-only PR with green CI → pass, safe_to_merge', () => {
    const r = evaluate({ title: 'docs: update readme', filesChanged: ['README.md'], ciStatus: 'success', state: 'open' });
    assert.equal(r.verdict, 'pass');
    assert.equal(r.mergeRecommendation, 'safe_to_merge');
    assert.equal(r.violatedPolicies.length, 0);
    assert.equal(r.policyScore, 0);
  });

  test('simple style fix → pass', () => {
    const r = evaluate({ title: 'style: fix button padding', filesChanged: ['src/app/globals.css'], ciStatus: 'success', state: 'open' });
    assert.equal(r.verdict, 'pass');
  });

  test('safe PR has empty evidence list', () => {
    const r = evaluate({ title: 'fix typo in docs', filesChanged: ['docs/guide.md'], ciStatus: 'success', state: 'open' });
    assert.equal(r.evidence.length, 0);
  });
});

// ── Score & severity ──────────────────────────────────────────────────────────

describe('Policy: score and severity', () => {
  test('blocked PR has score > 0', () => {
    const r = evaluate({ filesChanged: ['.env'], ciStatus: 'success', state: 'open' });
    assert.ok(r.policyScore > 0);
  });

  test('score is capped at 100', () => {
    const r = evaluate({
      filesChanged: ['.env', 'prisma/migrations/x/migration.sql', 'src/lib/auth/login.ts', 'Dockerfile'],
      ciStatus: 'failure',
      filesChangedCount: 60,
    });
    assert.ok(r.policyScore <= 100);
  });

  test('multiple violations → higher score than single violation', () => {
    const singleViolation = evaluate({ filesChanged: ['Dockerfile'], ciStatus: 'success', state: 'open' });
    const multiViolation = evaluate({
      filesChanged: ['Dockerfile', '.env', 'prisma/migrations/x.sql'],
      ciStatus: 'failure',
      state: 'open',
    });
    assert.ok(multiViolation.policyScore > singleViolation.policyScore);
  });
});

// ── Output fields ─────────────────────────────────────────────────────────────

describe('Policy: output fields always populated', () => {
  const cases: Array<Partial<PrPolicyInput>> = [
    {},
    { ciStatus: 'failure' },
    { filesChanged: ['.env'], ciStatus: 'success' },
    { filesChanged: ['README.md'], ciStatus: 'success' },
    { filesChangedCount: 0, filesChanged: [] },
  ];

  for (const c of cases) {
    test(`fields populated for: ${JSON.stringify(c)}`, () => {
      const r = evaluate(c);
      assert.ok(r.verdict);
      assert.ok(r.reason.length > 0);
      assert.ok(r.recommendedNextAction.length > 0);
      assert.ok(r.founderExplanation.length > 0);
      assert.ok(r.auditSummary.length > 0);
      assert.ok(r.mergeRecommendation);
      assert.ok(r.confidenceLevel);
      assert.equal(typeof r.policyScore, 'number');
    });
  }
});

// ── List helpers ──────────────────────────────────────────────────────────────

describe('summarizePolicyVerdicts', () => {
  test('counts all three verdict types correctly', () => {
    const results = [
      evaluate({ filesChanged: ['.env'], ciStatus: 'success' }),       // blocked
      evaluate({ filesChanged: ['prisma/schema.prisma'], ciStatus: 'success' }), // review_required
      evaluate({ filesChanged: ['README.md'], ciStatus: 'success' }),  // pass
      evaluate({ filesChanged: ['README.md'], ciStatus: 'success' }),  // pass
    ];
    const counts = summarizePolicyVerdicts(results);
    assert.equal(counts.blocked, 1);
    assert.equal(counts.review_required, 1);
    assert.equal(counts.pass, 2);
    assert.equal(counts.total, 4);
  });

  test('empty list → all zeros', () => {
    const counts = summarizePolicyVerdicts([]);
    assert.equal(counts.total, 0);
    assert.equal(counts.pass, 0);
    assert.equal(counts.blocked, 0);
    assert.equal(counts.review_required, 0);
  });
});

// ── Edge cases ────────────────────────────────────────────────────────────────

describe('Policy: edge cases', () => {
  test('empty title and no files → does not throw', () => {
    assert.doesNotThrow(() => evaluate({ title: '', filesChanged: [], filesChangedCount: 0 }));
  });

  test('null/undefined optional fields → does not throw', () => {
    assert.doesNotThrow(() =>
      evaluatePrPolicy({ title: 'test', body: null, ciStatus: null, labels: [], filesChanged: undefined, filesChangedCount: null }),
    );
  });

  test('pre-computed intel is used when _intel provided', () => {
    const { analyzePrImportance } = require('../prIntelligence.js');
    const intel = analyzePrImportance({ title: 'test', filesChanged: ['README.md'], ciStatus: 'success', state: 'open' });
    const r = evaluatePrPolicy({ title: 'test', filesChanged: ['README.md'], ciStatus: 'success', state: 'open', _intel: intel });
    assert.equal(r.verdict, 'pass');
  });

  test('merged PR with CI failure still gets CI violation flagged', () => {
    const r = evaluate({ filesChanged: ['README.md'], ciStatus: 'failure', merged: true, state: 'merged' });
    assert.ok(r.violatedPolicies.some((v) => v.category === 'ci_failure'));
  });
});
