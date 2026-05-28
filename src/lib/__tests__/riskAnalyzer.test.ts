import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeRisk, stripNegatedClauses } from '../riskAnalyzer.js';

describe('analyzeRisk', () => {
  test('bearer alone does not trigger secrets-exposure', () => {
    const flags = analyzeRisk('Use bearer authentication for the endpoint.');
    const keys = flags.map((f) => f.key);
    assert.ok(!keys.includes('secrets-exposure'), 'bearer alone should not flag secrets-exposure');
  });

  test('bearer with 16-char token triggers secrets-exposure exactly once', () => {
    const flags = analyzeRisk('Authorization: bearer abcdef1234567890');
    const secretFlags = flags.filter((f) => f.key === 'secrets-exposure');
    assert.equal(secretFlags.length, 1, 'bearer+token should trigger secrets-exposure exactly once');
  });

  test('rm -rf triggers destructive-command', () => {
    const flags = analyzeRisk('Run rm -rf /tmp/build to clean up.');
    const keys = flags.map((f) => f.key);
    assert.ok(keys.includes('destructive-command'), 'rm -rf should trigger destructive-command');
  });

  test('prisma migrate triggers database-migration', () => {
    const flags = analyzeRisk('Run prisma migrate dev to apply schema changes.');
    const keys = flags.map((f) => f.key);
    assert.ok(keys.includes('database-migration'), 'prisma migrate should trigger database-migration');
  });

  test('clean text returns no flags', () => {
    const flags = analyzeRisk('Updated the button label from Save to Submit.');
    assert.equal(flags.length, 0, 'clean text should return no risk flags');
  });

  test('auth keyword triggers auth-security-change', () => {
    const flags = analyzeRisk('Modify the authentication middleware.');
    const keys = flags.map((f) => f.key);
    assert.ok(keys.includes('auth-security-change'), 'auth keyword should trigger auth-security-change');
  });
});

describe('analyzeRisk — negation / false-positive suppression', () => {
  test('"No production touched." does NOT trigger production-environment', () => {
    const flags = analyzeRisk('No production touched.');
    const keys = flags.map((f) => f.key);
    assert.ok(!keys.includes('production-environment'), '"No production touched." must not flag production-environment');
  });

  test('"No files deleted." does NOT trigger destructive-command', () => {
    const flags = analyzeRisk('No files deleted.');
    const keys = flags.map((f) => f.key);
    assert.ok(!keys.includes('destructive-command'), '"No files deleted." must not flag destructive-command');
  });

  test('"No DB changes made." does NOT trigger database-migration', () => {
    const flags = analyzeRisk('No DB changes made.');
    const keys = flags.map((f) => f.key);
    assert.ok(!keys.includes('database-migration'), '"No DB changes made." must not flag database-migration');
  });

  test('"No secrets printed." does NOT trigger secrets-exposure', () => {
    const flags = analyzeRisk('No secrets printed.');
    const keys = flags.map((f) => f.key);
    assert.ok(!keys.includes('secrets-exposure'), '"No secrets printed." must not flag secrets-exposure');
  });

  test('full safe DEV-status sample returns no flags', () => {
    const safe =
      'Checked DEV containers. calibre-api-dev, calibre-web-dev, calibre-workers-dev, postgres, and redis are running. ' +
      'No duplicate containers found. No files deleted. No DB changes made. No production touched.';
    const flags = analyzeRisk(safe);
    assert.equal(flags.length, 0, 'safe DEV status report should return no risk flags');
  });

  test('risky sample still triggers production-environment', () => {
    const risky =
      'I deleted the old Docker volume, checked the production database, and found an exposed token in the logs.';
    const keys = analyzeRisk(risky).map((f) => f.key);
    assert.ok(keys.includes('production-environment'), 'risky sample must still flag production-environment');
  });

  test('explicit destructive command still triggers despite negation context', () => {
    const risky = 'Ran rm -rf /tmp/build to clean old artifacts, no production touched.';
    const keys = analyzeRisk(risky).map((f) => f.key);
    assert.ok(keys.includes('destructive-command'), 'rm -rf must still flag destructive-command');
    assert.ok(!keys.includes('production-environment'), 'negated production clause must not flag production-environment');
  });

  test('"did not touch production" does NOT trigger production-environment', () => {
    const flags = analyzeRisk('I did not touch production during this run.');
    const keys = flags.map((f) => f.key);
    assert.ok(!keys.includes('production-environment'), '"did not touch production" must not flag production-environment');
  });
});

describe('stripNegatedClauses', () => {
  test('strips "No X." sentence', () => {
    const result = stripNegatedClauses('No production touched. Service is healthy.');
    assert.ok(!result.includes('production'), 'stripped text should not contain "production"');
    assert.ok(result.includes('healthy'), 'non-negated text should be preserved');
  });

  test('strips "did not" clause', () => {
    const result = stripNegatedClauses('I did not modify the production database.');
    assert.ok(!result.includes('production'), 'stripped text should not contain "production"');
  });

  test('preserves risky positive assertion', () => {
    const result = stripNegatedClauses('I checked the production database directly.');
    assert.ok(result.includes('production'), 'positive assertion of production should be preserved');
  });
});
