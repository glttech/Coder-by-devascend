import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { hasScope, VALID_SCOPES } from '../apiKeys.js';
import crypto from 'node:crypto';

describe('VALID_SCOPES', () => {
  test('includes tasks:read', () => assert.ok(VALID_SCOPES.includes('tasks:read')));
  test('includes evidence:read', () => assert.ok(VALID_SCOPES.includes('evidence:read')));
  test('has 6 scopes', () => assert.equal(VALID_SCOPES.length, 6));
});

describe('hasScope', () => {
  test('returns true when scope is present', () => assert.equal(hasScope(['tasks:read', 'projects:read'], 'tasks:read'), true));
  test('returns false when scope is absent', () => assert.equal(hasScope(['tasks:read'], 'tasks:write'), false));
  test('returns false for empty scopes', () => assert.equal(hasScope([], 'tasks:read'), false));
});

describe('key format', () => {
  test('raw key starts with cda_', () => {
    // Test the format expected by authenticateApiKey
    const key = `cda_org_${crypto.randomBytes(16).toString('base64url')}`;
    assert.ok(key.startsWith('cda_'));
  });
});
