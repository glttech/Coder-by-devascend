import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeRisk } from '../riskAnalyzer.js';

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
