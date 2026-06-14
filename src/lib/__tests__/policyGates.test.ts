import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { evaluatePolicy, DEFAULT_POLICY_RULES } from '../policyGates.js';

describe('evaluatePolicy — clean input', () => {
  it('returns no violations for clean input', () => {
    const result = evaluatePolicy({ title: 'Fix UI bug', instruction: 'Change button color', riskLevel: 'low', environment: 'dev' });
    assert.equal(result.violations.length, 0);
    assert.equal(result.blocked, false);
    assert.equal(result.highestSeverity, 'none');
  });
});

describe('evaluatePolicy — env_config rule', () => {
  it('triggers env_config rule when DATABASE_URL appears in instruction', () => {
    const result = evaluatePolicy({ title: 'Update config', instruction: 'Change the DATABASE_URL value', riskLevel: 'low', environment: 'dev' });
    assert.ok(result.violations.some(v => v.ruleId === 'env-config'), 'env-config violation expected');
    assert.equal(result.blocked, true);
  });
});

describe('evaluatePolicy — production rule', () => {
  it('triggers production rule when environment is production and instruction matches', () => {
    const result = evaluatePolicy({ title: 'Deploy', instruction: 'deploy to production environment', riskLevel: 'high', environment: 'production' });
    assert.ok(result.violations.some(v => v.ruleId === 'production-deploy'), 'production-deploy violation expected');
  });
});

describe('evaluatePolicy — auth-changes rule risk filtering', () => {
  it('does NOT trigger auth-changes rule for low risk', () => {
    const result = evaluatePolicy({ title: 'auth test', instruction: 'update authentication middleware', riskLevel: 'low', environment: 'dev' });
    assert.equal(result.violations.some(v => v.ruleId === 'auth-changes'), false);
  });

  it('triggers auth-changes rule for high risk', () => {
    const result = evaluatePolicy({ title: 'auth update', instruction: 'update authentication middleware', riskLevel: 'high', environment: 'dev' });
    assert.ok(result.violations.some(v => v.ruleId === 'auth-changes'), 'auth-changes violation expected');
    assert.equal(result.blocked, true);
  });
});

describe('evaluatePolicy — requiresApproval for require_approval violations', () => {
  it('sets requiresApproval true for require_approval violations', () => {
    const result = evaluatePolicy({ title: 'db migration', instruction: 'run prisma migrate', riskLevel: 'low', environment: 'dev' });
    assert.equal(result.requiresApproval, true);
    assert.equal(result.blocked, false);
  });
});

describe('evaluatePolicy — highestSeverity', () => {
  it('returns block as highestSeverity when a blocking rule fires', () => {
    const result = evaluatePolicy({ title: 'billing', instruction: 'update stripe payment integration', riskLevel: 'low', environment: 'dev' });
    assert.equal(result.highestSeverity, 'block');
  });

  it('returns require_approval as highestSeverity for only approval violations', () => {
    const result = evaluatePolicy({ title: 'schema', instruction: 'run prisma migrate deploy', riskLevel: 'low', environment: 'dev' });
    assert.equal(result.highestSeverity, 'require_approval');
    assert.equal(result.blocked, false);
  });
});

describe('evaluatePolicy — destructive commands', () => {
  it('triggers destructive-commands for rm -rf', () => {
    const result = evaluatePolicy({ title: 'cleanup', instruction: 'run rm -rf /tmp/build', riskLevel: 'low', environment: 'dev' });
    assert.ok(result.violations.some(v => v.ruleId === 'destructive-commands'), 'destructive-commands expected');
    assert.equal(result.requiresApproval, true);
  });
});

describe('evaluatePolicy — infra changes via title', () => {
  it('triggers infra-changes when title contains docker', () => {
    const result = evaluatePolicy({ title: 'update docker config', instruction: 'some change', riskLevel: 'low', environment: 'dev' });
    assert.ok(result.violations.some(v => v.ruleId === 'infra-changes'), 'infra-changes expected via title');
  });
});

describe('evaluatePolicy — custom rules', () => {
  it('respects custom rule set overriding defaults', () => {
    const result = evaluatePolicy(
      { title: 'anything', instruction: 'do anything', riskLevel: 'low', environment: 'dev' },
      [],
    );
    assert.equal(result.violations.length, 0);
    assert.equal(result.highestSeverity, 'none');
  });
});
