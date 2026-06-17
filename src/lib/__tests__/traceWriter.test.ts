/**
 * Tests for the Execution Trace writer (PR 1.2).
 *
 * Uses node:test — NOT Jest. No real DB calls.
 * writeTrace swallows DB errors by design, so tests confirm it resolves without throwing.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { redactSensitive, writeTrace } from '../trace/writer.js';

// ---------------------------------------------------------------------------
// redactSensitive tests
// ---------------------------------------------------------------------------

describe('redactSensitive', () => {
  it('removes API key patterns: api_key=sk-abc123def456', () => {
    const input = 'api_key=sk-abc123def456';
    const result = redactSensitive(input);
    assert.ok(result !== undefined, 'result must not be undefined');
    assert.ok(result.includes('[REDACTED]'), `Expected [REDACTED] in: ${result}`);
    assert.ok(!result.includes('sk-abc123def456'), 'Original key must not appear in output');
  });

  it('removes secret patterns: SECRET_KEY=mysecretvalue123', () => {
    const input = 'SECRET_KEY=mysecretvalue123';
    const result = redactSensitive(input);
    assert.ok(result !== undefined);
    assert.ok(result.includes('[REDACTED]'), `Expected [REDACTED] in: ${result}`);
    assert.ok(!result.includes('mysecretvalue123'), 'Secret value must not appear in output');
  });

  it('removes bearer tokens: Authorization: Bearer mytoken123abc', () => {
    const input = 'Authorization: Bearer mytoken123abc';
    const result = redactSensitive(input);
    assert.ok(result !== undefined);
    assert.ok(result.includes('[REDACTED]'), `Expected [REDACTED] in: ${result}`);
    assert.ok(!result.includes('mytoken123abc'), 'Token must not appear in output');
  });

  it('removes cda__ prefixed API keys: key: cda__abc123def456ghi', () => {
    const input = 'key: cda__abc123def456ghi';
    const result = redactSensitive(input);
    assert.ok(result !== undefined);
    assert.ok(result.includes('[REDACTED]'), `Expected [REDACTED] in: ${result}`);
    assert.ok(!result.includes('cda__abc123def456ghi'), 'CDA key must not appear in output');
  });

  it('preserves safe content: const taskTitle = "Hello world";', () => {
    const input = 'const taskTitle = \'Hello world\';';
    const result = redactSensitive(input);
    assert.equal(result, input, 'Safe content must pass through unchanged');
  });

  it('returns undefined for undefined input', () => {
    const result = redactSensitive(undefined);
    assert.equal(result, undefined, 'undefined input must return undefined');
  });
});

// ---------------------------------------------------------------------------
// writeTrace error-swallowing test
// ---------------------------------------------------------------------------

describe('writeTrace', () => {
  it('swallows DB errors and resolves without throwing', async () => {
    // writeTrace will attempt a prisma.executionTrace.create which will fail
    // because there is no DB in CI. The function MUST catch and swallow the error.
    await assert.doesNotReject(
      () =>
        writeTrace({
          taskId: 'test-task-does-not-exist',
          roleKey: 'security_reviewer',
          promptSent: 'Review the auth flow api_key=should-be-redacted',
          riskScore: 0.75,
          riskFlags: ['auth-security-change'],
          decisionCode: 'SENIOR_APPROVAL_REQUIRED',
          approvalState: 'pending',
          finalOutput: JSON.stringify({ recommendation: 'Review required' }),
        }),
      'writeTrace must not throw even when DB is unavailable',
    );
  });
});
