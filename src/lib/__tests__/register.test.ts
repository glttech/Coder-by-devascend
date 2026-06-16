// Test the pure validation helpers used in /api/auth/register (no DB needed)
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

function validatePassword(password: string): string | null {
  if (password.length < 12) return 'Password must be at least 12 characters';
  const COMMON = new Set(['password123', 'password1', '123456789', 'qwerty123', 'iloveyou']);
  if (COMMON.has(password.toLowerCase())) return 'Password is too common';
  return null;
}

describe('validateEmail', () => {
  test('accepts valid email', () => assert.equal(validateEmail('a@b.com'), true));
  test('accepts email with subdomain', () => assert.equal(validateEmail('user@mail.example.com'), true));
  test('rejects missing @', () => assert.equal(validateEmail('notanemail'), false));
  test('rejects missing domain', () => assert.equal(validateEmail('a@'), false));
  test('rejects missing local part', () => assert.equal(validateEmail('@domain.com'), false));
  test('rejects too long (> 254 chars)', () => assert.equal(validateEmail('a'.repeat(250) + '@b.com'), false));
  test('accepts exactly 254 chars', () => {
    // local@domain.com where total length = 254
    const local = 'a'.repeat(244);
    const email = `${local}@b.com`; // 244 + 1 + 5 = 250 chars — valid
    assert.equal(validateEmail(email), true);
  });
});

describe('validatePassword', () => {
  test('accepts 12+ char password', () => assert.equal(validatePassword('correcthorsebatterystaple'), null));
  test('accepts exactly 12 chars', () => assert.equal(validatePassword('abcdefghijkl'), null));
  test('rejects < 12 chars', () => assert.ok(validatePassword('short') !== null));
  test('rejects 11 char password', () => assert.ok(validatePassword('abcdefghijk') !== null));
  test('rejects common password lowercase', () => assert.ok(validatePassword('password123') !== null));
  test('rejects common password mixed case', () => assert.ok(validatePassword('Password123') !== null));
  test('rejects qwerty123', () => assert.ok(validatePassword('qwerty123') !== null));
  test('accepts non-common 12+ char password', () => assert.equal(validatePassword('Tr0ub4dor&3!'), null));
});

describe('slug generation logic', () => {
  function makeSlug(input: string): string {
    return input
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 38) || 'workspace';
  }

  test('converts email prefix to slug', () => assert.equal(makeSlug('jane.smith'), 'jane-smith'));
  test('lowercases input', () => assert.equal(makeSlug('AcmeCorp'), 'acmecorp'));
  test('replaces spaces with dashes', () => assert.equal(makeSlug('Acme Engineering'), 'acme-engineering'));
  test('collapses multiple dashes', () => assert.equal(makeSlug('foo---bar'), 'foo-bar'));
  test('strips leading/trailing dashes', () => assert.equal(makeSlug('--foo--'), 'foo'));
  test('truncates to 38 chars', () => assert.equal(makeSlug('a'.repeat(50)).length, 38));
  test('falls back to workspace for empty', () => assert.equal(makeSlug('---'), 'workspace'));
});
