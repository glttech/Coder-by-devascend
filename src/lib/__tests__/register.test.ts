import { test } from 'node:test';
import assert from 'node:assert/strict';

function validatePassword(password: string): { ok: boolean; error?: string } {
  if (password.length < 12) return { ok: false, error: 'Password must be at least 12 characters' };
  return { ok: true };
}

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function passwordsMatch(password: string, confirm: string): boolean {
  return password === confirm;
}

test('password < 12 chars is rejected', () => {
  const result = validatePassword('short');
  assert.equal(result.ok, false);
  assert.equal(result.error, 'Password must be at least 12 characters');
});

test('password >= 12 chars is accepted', () => {
  const result = validatePassword('longEnoughPassword1!');
  assert.equal(result.ok, true);
  assert.equal(result.error, undefined);
});

test('invalid email is rejected', () => {
  assert.equal(validateEmail('not-an-email'), false);
  assert.equal(validateEmail('missing@domain'), false);
  assert.equal(validateEmail('@nodomain.com'), false);
});

test('password mismatch is rejected', () => {
  assert.equal(passwordsMatch('password123456', 'password123456'), true);
  assert.equal(passwordsMatch('password123456', 'differentPassword!'), false);
});
