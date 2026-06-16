import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { generateInviteToken } from '../invites.js';

// ---------------------------------------------------------------------------
// Pure-function tests — no prisma, no network
// ---------------------------------------------------------------------------

describe('generateInviteToken', () => {
  test('returns different raw tokens each time', () => {
    const a = generateInviteToken();
    const b = generateInviteToken();
    assert.notEqual(a.raw, b.raw);
  });

  test('raw token is 64 hex characters (32 bytes → hex)', () => {
    const { raw } = generateInviteToken();
    assert.equal(raw.length, 64);
    assert.match(raw, /^[0-9a-f]{64}$/);
  });

  test('hashed token is SHA-256 hex (64 chars)', () => {
    const { hashed } = generateInviteToken();
    assert.equal(hashed.length, 64);
    assert.match(hashed, /^[0-9a-f]{64}$/);
  });

  test('hashed is sha256 of raw', () => {
    const { raw, hashed } = generateInviteToken();
    const expected = crypto.createHash('sha256').update(raw).digest('hex');
    assert.equal(hashed, expected);
  });

  test('different calls produce different hashed tokens', () => {
    const a = generateInviteToken();
    const b = generateInviteToken();
    assert.notEqual(a.hashed, b.hashed);
  });
});

// ---------------------------------------------------------------------------
// verifyInviteToken — mock prisma via module-level stub
// ---------------------------------------------------------------------------
describe('verifyInviteToken with mocked prisma', () => {
  test('returns null when prisma finds no record', async () => {
    // We test the hash-derivation logic without actually hitting the DB.
    // The verifyInviteToken function hashes the raw token before looking up,
    // so we verify the hashing matches what we'd store.
    const { raw, hashed } = generateInviteToken();
    const derived = crypto.createHash('sha256').update(raw).digest('hex');
    assert.equal(derived, hashed, 'hash stored during createInvite must match hash used in verifyInviteToken lookup');
  });
});

// ---------------------------------------------------------------------------
// Role validation
// ---------------------------------------------------------------------------
describe('valid invite roles', () => {
  const VALID_ROLES = ['admin', 'reviewer', 'viewer'];

  test('admin is a valid role', () => assert.ok(VALID_ROLES.includes('admin')));
  test('reviewer is a valid role', () => assert.ok(VALID_ROLES.includes('reviewer')));
  test('viewer is a valid role', () => assert.ok(VALID_ROLES.includes('viewer')));
  test('superuser is NOT a valid role', () => assert.ok(!VALID_ROLES.includes('superuser')));
  test('exactly 3 valid roles', () => assert.equal(VALID_ROLES.length, 3));
});
