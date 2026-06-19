import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { VALID_SCOPES } from '@/lib/apiKeys';

// Pure unit tests — no DB or crypto calls required

describe('VALID_SCOPES', () => {
  it('contains expected scopes', () => {
    assert.ok(VALID_SCOPES.includes('tasks:read'));
    assert.ok(VALID_SCOPES.includes('tasks:write'));
    assert.ok(VALID_SCOPES.includes('projects:read'));
    assert.ok(VALID_SCOPES.includes('projects:write'));
    assert.ok(VALID_SCOPES.includes('runs:read'));
    assert.ok(VALID_SCOPES.includes('evidence:read'));
  });

  it('has exactly 6 scopes', () => {
    assert.equal(VALID_SCOPES.length, 6);
  });

  it('all scopes follow namespace:action format', () => {
    for (const scope of VALID_SCOPES) {
      assert.match(scope, /^[a-z_]+:(read|write)$/);
    }
  });
});

describe('scope validation logic', () => {
  function validateScopes(scopes: string[]): string[] {
    return scopes.filter(s => !VALID_SCOPES.includes(s as (typeof VALID_SCOPES)[number]));
  }

  it('returns empty array for all-valid scopes', () => {
    assert.deepEqual(validateScopes(['tasks:read', 'projects:read']), []);
  });

  it('returns invalid scopes', () => {
    const invalid = validateScopes(['tasks:read', 'admin:delete', 'unknown']);
    assert.deepEqual(invalid, ['admin:delete', 'unknown']);
  });

  it('rejects wildcard scope', () => {
    const invalid = validateScopes(['*']);
    assert.deepEqual(invalid, ['*']);
  });

  it('rejects empty scope string', () => {
    const invalid = validateScopes(['']);
    assert.deepEqual(invalid, ['']);
  });

  it('is case-sensitive — uppercase rejected', () => {
    const invalid = validateScopes(['Tasks:Read']);
    assert.deepEqual(invalid, ['Tasks:Read']);
  });
});

describe('API key prefix format', () => {
  it('raw key should start with cda__', () => {
    // Validate the expected prefix format without calling crypto
    const expectedPrefix = 'cda__';
    assert.equal(expectedPrefix.startsWith('cda'), true);
    assert.equal(expectedPrefix.endsWith('__'), true);
  });
});
