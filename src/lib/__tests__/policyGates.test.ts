import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { evaluatePolicy, DEFAULT_POLICY_RULES, type PolicyEvalResult } from '../policyGates.js';

// Helper: build a minimal clean input
function makeInput(
  overrides: Partial<{ title: string; instruction: string; riskLevel: string; environment: string }> = {},
) {
  return {
    title: 'Fix button alignment on homepage',
    instruction: 'Adjust the CSS padding for the submit button on the homepage.',
    riskLevel: 'low',
    environment: 'dev',
    ...overrides,
  };
}

// -----------------------------------------------------------------------
// Basic shape checks
// -----------------------------------------------------------------------

describe('evaluatePolicy — result shape', () => {
  it('returns a well-formed PolicyEvalResult for a clean task', () => {
    const result = evaluatePolicy(makeInput());
    assert.ok(Array.isArray(result.violations), 'violations must be an array');
    assert.equal(typeof result.blocked, 'boolean');
    assert.equal(typeof result.requiresApproval, 'boolean');
    assert.ok(['block', 'require_approval', 'none'].includes(result.highestSeverity));
  });
});

// -----------------------------------------------------------------------
// Clean input — no violations
// -----------------------------------------------------------------------

describe('evaluatePolicy — clean instruction', () => {
  it('clean task with safe instruction returns no violations', () => {
    const result = evaluatePolicy(makeInput());
    assert.equal(result.violations.length, 0);
    assert.equal(result.blocked, false);
    assert.equal(result.requiresApproval, false);
    assert.equal(result.highestSeverity, 'none');
  });
});

// -----------------------------------------------------------------------
// env_config rule — triggers on DATABASE_URL in instruction
// -----------------------------------------------------------------------

describe('evaluatePolicy — env_config rule', () => {
  it('instruction containing DATABASE_URL triggers env_config rule', () => {
    const result = evaluatePolicy(
      makeInput({ instruction: 'Update the DATABASE_URL in .env to point to the new host.' }),
    );
    const violation = result.violations.find((v) => v.ruleId === 'env-config');
    assert.ok(violation, 'env-config violation must be present');
    assert.equal(violation.severity, 'block');
    assert.equal(result.blocked, true);
    assert.equal(result.highestSeverity, 'block');
  });

  it('instruction containing SESSION_SECRET triggers env_config rule', () => {
    const result = evaluatePolicy(
      makeInput({ instruction: 'Rotate the SESSION_SECRET in the config.' }),
    );
    const violation = result.violations.find((v) => v.ruleId === 'env-config');
    assert.ok(violation, 'env-config violation must be present');
  });

  it('instruction containing "secrets" triggers env_config rule', () => {
    const result = evaluatePolicy(
      makeInput({ instruction: 'Move all secrets to the vault.' }),
    );
    const violation = result.violations.find((v) => v.ruleId === 'env-config');
    assert.ok(violation, 'env-config violation must be present');
  });
});

// -----------------------------------------------------------------------
// production-deploy rule — triggers on environment=production
// -----------------------------------------------------------------------

describe('evaluatePolicy — production-deploy rule', () => {
  it('environment=production with matching instruction triggers production rule', () => {
    const result = evaluatePolicy(
      makeInput({
        instruction: 'Deploy to production the latest release build.',
        environment: 'production',
      }),
    );
    const violation = result.violations.find((v) => v.ruleId === 'production-deploy');
    assert.ok(violation, 'production-deploy violation must be present');
    assert.equal(violation.severity, 'block');
  });

  it('environment=production but instruction has no production keyword — no production-deploy violation', () => {
    const result = evaluatePolicy(
      makeInput({
        instruction: 'Fix a typo in the README.',
        environment: 'production',
      }),
    );
    const violation = result.violations.find((v) => v.ruleId === 'production-deploy');
    assert.equal(violation, undefined, 'should not trigger without a matching instruction keyword');
  });

  it('instruction says "deploy to production" but environment=dev — still triggers via instruction pattern', () => {
    const result = evaluatePolicy(
      makeInput({
        instruction: 'deploy to production the hotfix branch.',
        environment: 'dev',
      }),
    );
    const violation = result.violations.find((v) => v.ruleId === 'production-deploy');
    assert.ok(violation, 'instruction pattern match should fire even if environment!=production');
  });
});

// -----------------------------------------------------------------------
// auth-changes rule — only triggers on riskLevel=high
// -----------------------------------------------------------------------

describe('evaluatePolicy — auth-changes rule (riskLevels constraint)', () => {
  it('riskLevel=low does NOT trigger auth-changes rule even with auth keywords', () => {
    const result = evaluatePolicy(
      makeInput({
        instruction: 'Add authentication middleware to the admin routes.',
        riskLevel: 'low',
      }),
    );
    const violation = result.violations.find((v) => v.ruleId === 'auth-changes');
    assert.equal(violation, undefined, 'auth-changes must not fire for low-risk tasks');
  });

  it('riskLevel=medium does NOT trigger auth-changes rule', () => {
    const result = evaluatePolicy(
      makeInput({
        instruction: 'Refactor the JWT token verification logic.',
        riskLevel: 'medium',
      }),
    );
    const violation = result.violations.find((v) => v.ruleId === 'auth-changes');
    assert.equal(violation, undefined, 'auth-changes must not fire for medium-risk tasks');
  });

  it('riskLevel=high DOES trigger auth-changes rule with auth keywords', () => {
    const result = evaluatePolicy(
      makeInput({
        instruction: 'Overhaul the JWT authentication middleware and session handling.',
        riskLevel: 'high',
      }),
    );
    const violation = result.violations.find((v) => v.ruleId === 'auth-changes');
    assert.ok(violation, 'auth-changes must fire for high-risk auth tasks');
    assert.equal(violation.severity, 'block');
  });
});

// -----------------------------------------------------------------------
// Severity aggregation
// -----------------------------------------------------------------------

describe('evaluatePolicy — severity aggregation', () => {
  it('block violation sets blocked=true', () => {
    const result = evaluatePolicy(
      makeInput({ instruction: 'Integrate Stripe payment gateway for checkout flow.' }),
    );
    assert.equal(result.blocked, true);
    assert.equal(result.highestSeverity, 'block');
  });

  it('require_approval violation (only) sets requiresApproval=true and blocked=false', () => {
    const result = evaluatePolicy(
      makeInput({ instruction: 'Run prisma migrate to add new columns to the users table.' }),
    );
    const violation = result.violations.find((v) => v.ruleId === 'db-migration');
    assert.ok(violation, 'db-migration violation must be present');
    assert.equal(violation.severity, 'require_approval');
    assert.equal(result.requiresApproval, true);
    assert.equal(result.blocked, false);
    assert.equal(result.highestSeverity, 'require_approval');
  });

  it('mixed violations — block wins over require_approval in highestSeverity', () => {
    // Both db-migration (require_approval) and payment-billing (block) patterns
    const result = evaluatePolicy(
      makeInput({
        instruction: 'Run prisma migrate and integrate Stripe payment gateway.',
      }),
    );
    assert.equal(result.blocked, true);
    assert.equal(result.requiresApproval, true);
    assert.equal(result.highestSeverity, 'block');
  });
});

// -----------------------------------------------------------------------
// Multiple violations returned
// -----------------------------------------------------------------------

describe('evaluatePolicy — multiple violations', () => {
  it('returns all matching violations, not just the first', () => {
    const result = evaluatePolicy(
      makeInput({
        instruction:
          'Run prisma migrate to alter tables and integrate Stripe payment for subscription billing.',
      }),
    );
    // Should match at least db-migration and payment-billing
    assert.ok(result.violations.length >= 2, `expected >= 2 violations, got ${result.violations.length}`);
    const ids = result.violations.map((v) => v.ruleId);
    assert.ok(ids.includes('db-migration'), 'db-migration must be in violations');
    assert.ok(ids.includes('payment-billing'), 'payment-billing must be in violations');
  });
});

// -----------------------------------------------------------------------
// db-migration rule — title pattern match
// -----------------------------------------------------------------------

describe('evaluatePolicy — title pattern matching', () => {
  it('title containing "schema" triggers db-migration even with neutral instruction', () => {
    const result = evaluatePolicy(
      makeInput({
        title: 'Schema update for users table',
        instruction: 'Update the database schema to add a new column.',
      }),
    );
    const violation = result.violations.find((v) => v.ruleId === 'db-migration');
    assert.ok(violation, 'db-migration must fire on schema title pattern');
  });
});

// -----------------------------------------------------------------------
// Custom rules
// -----------------------------------------------------------------------

describe('evaluatePolicy — custom rules override', () => {
  it('passes with an empty rules array regardless of instruction', () => {
    const result = evaluatePolicy(
      makeInput({ instruction: 'deploy to production and drop database' }),
      [],
    );
    assert.equal(result.violations.length, 0);
    assert.equal(result.blocked, false);
  });

  it('respects a custom rule', () => {
    const result = evaluatePolicy(makeInput({ instruction: 'reticulate splines in prod' }), [
      {
        id: 'custom-spline',
        name: 'Spline Reticulation',
        description: 'Custom: do not reticulate splines',
        category: 'infra',
        severity: 'require_approval',
        instructionPatterns: ['reticulate splines'],
      },
    ]);
    assert.equal(result.violations.length, 1);
    assert.equal(result.violations[0].ruleId, 'custom-spline');
    assert.equal(result.requiresApproval, true);
  });
});

// -----------------------------------------------------------------------
// destructive-commands rule
// -----------------------------------------------------------------------

describe('evaluatePolicy — destructive-commands rule', () => {
  it('instruction with "rm -rf" triggers destructive rule', () => {
    const result = evaluatePolicy(
      makeInput({ instruction: 'Clean up old builds by running rm -rf ./dist' }),
    );
    const violation = result.violations.find((v) => v.ruleId === 'destructive-commands');
    assert.ok(violation, 'destructive-commands must fire');
    assert.equal(violation.severity, 'require_approval');
  });

  it('instruction with "drop database" triggers destructive rule', () => {
    const result = evaluatePolicy(
      makeInput({ instruction: 'Drop database and recreate from migrations.' }),
    );
    const violation = result.violations.find((v) => v.ruleId === 'destructive-commands');
    assert.ok(violation);
  });
});
