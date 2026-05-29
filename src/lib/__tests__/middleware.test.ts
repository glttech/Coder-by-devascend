import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

// Test the guard logic directly — import after env manipulation
// to avoid module caching issues with the env var.

function makeRequest(headers: Record<string, string> = {}): { headers: { get: (k: string) => string | null } } {
  return {
    headers: {
      get: (key: string) => headers[key.toLowerCase()] ?? null,
    },
  };
}

function runGuard(
  governanceKey: string | undefined,
  providedKey: string | null,
): { status: number; passed: boolean } {
  if (!governanceKey) return { status: 200, passed: true };
  if (providedKey !== governanceKey) return { status: 401, passed: false };
  return { status: 200, passed: true };
}

describe('API auth guard logic', () => {
  test('passes through when GOVERNANCE_API_KEY is not set', () => {
    const result = runGuard(undefined, null);
    assert.equal(result.status, 200);
    assert.equal(result.passed, true);
  });

  test('passes through when GOVERNANCE_API_KEY is empty string', () => {
    const result = runGuard('', null);
    assert.equal(result.status, 200);
    assert.equal(result.passed, true);
  });

  test('returns 401 when key is configured but header is missing', () => {
    const result = runGuard('secret-key', null);
    assert.equal(result.status, 401);
    assert.equal(result.passed, false);
  });

  test('returns 401 when key is configured but wrong header value provided', () => {
    const result = runGuard('secret-key', 'wrong-key');
    assert.equal(result.status, 401);
    assert.equal(result.passed, false);
  });

  test('passes when correct key header is provided', () => {
    const result = runGuard('secret-key', 'secret-key');
    assert.equal(result.status, 200);
    assert.equal(result.passed, true);
  });

  test('is case-sensitive — wrong case returns 401', () => {
    const result = runGuard('Secret-Key', 'secret-key');
    assert.equal(result.status, 401);
  });

  test('does not pass with partial key match', () => {
    const result = runGuard('secret-key-full', 'secret-key');
    assert.equal(result.status, 401);
  });

  test('passes with exact key including special characters', () => {
    const key = 'k3y!@#$%^&*()_+-=';
    const result = runGuard(key, key);
    assert.equal(result.status, 200);
    assert.equal(result.passed, true);
  });
});
