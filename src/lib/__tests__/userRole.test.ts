/**
 * Tests for UserRole type (session.ts) and buildAdminSeedPayload (prisma/seed-admin.ts).
 * Uses node:test + node:assert/strict.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// Type-level import — if this import fails to compile, UserRole doesn't exist.
import type { UserRole } from '../session.js';
import { buildAdminSeedPayload } from '../../../prisma/seed-admin.js';

// ── UserRole type tests ────────────────────────────────────────────────────

describe('UserRole type', () => {
  test("'admin' is a valid UserRole value", () => {
    // Compile-time assertion: assigning 'admin' to UserRole must not produce a TS error.
    const role: UserRole = 'admin';
    assert.equal(role, 'admin');
  });

  test("'reviewer' is a valid UserRole value", () => {
    const role: UserRole = 'reviewer';
    assert.equal(role, 'reviewer');
  });

  test('UserRole values are distinct strings', () => {
    const admin: UserRole = 'admin';
    const reviewer: UserRole = 'reviewer';
    assert.notEqual(admin, reviewer);
  });
});

// ── buildAdminSeedPayload tests ────────────────────────────────────────────

describe('buildAdminSeedPayload', () => {
  test('returns correct payload for a valid email', () => {
    const payload = buildAdminSeedPayload('admin@example.com');
    assert.deepEqual(payload, {
      email: 'admin@example.com',
      name: 'Admin',
      role: 'admin',
    });
  });

  test('sets role to "admin" regardless of the email address', () => {
    const payload = buildAdminSeedPayload('someone@corp.io');
    assert.equal(payload.role, 'admin');
  });

  test('sets name to "Admin" always', () => {
    const payload = buildAdminSeedPayload('x@y.com');
    assert.equal(payload.name, 'Admin');
  });

  test('preserves the exact email passed in', () => {
    const email = 'ops-admin@dev.internal';
    const payload = buildAdminSeedPayload(email);
    assert.equal(payload.email, email);
  });

  test('throws when email is an empty string', () => {
    assert.throws(() => buildAdminSeedPayload(''), /non-empty/);
  });

  test('does not include any password-related fields in the payload', () => {
    const payload = buildAdminSeedPayload('safe@example.com');
    const keys = Object.keys(payload);
    assert.ok(!keys.includes('password'), 'payload must not have a password field');
    assert.ok(!keys.includes('passwordHash'), 'payload must not have a passwordHash field');
  });

  test('payload has exactly the expected keys', () => {
    const payload = buildAdminSeedPayload('admin@example.com');
    assert.deepEqual(Object.keys(payload).sort(), ['email', 'name', 'role'].sort());
  });
});
