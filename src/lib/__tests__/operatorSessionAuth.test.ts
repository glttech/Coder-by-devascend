import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { requireRole } from '../rbac.js';
import type { AppSession } from '../session.js';

const admin: AppSession = {
  userId: 'user-admin-1',
  username: 'admin@example.com',
  role: 'admin',
  loginAt: '2024-01-01T00:00:00.000Z',
  sessionId: 'session-admin-1',
};

const reviewer: AppSession = {
  userId: 'user-reviewer-1',
  username: 'reviewer@example.com',
  role: 'reviewer',
  loginAt: '2024-01-01T00:00:00.000Z',
  sessionId: 'session-reviewer-1',
};

describe('GET /api/operator-sessions auth', () => {
  test('rejects unauthenticated request with 401', () => {
    const check = requireRole(null, 'any');
    assert.equal(check.ok, false);
    if (!check.ok) assert.equal(check.status, 401);
  });

  test('allows admin user', () => {
    const check = requireRole(admin, 'any');
    assert.equal(check.ok, true);
  });

  test('allows reviewer user', () => {
    const check = requireRole(reviewer, 'any');
    assert.equal(check.ok, true);
  });
});

describe('POST /api/operator-sessions auth', () => {
  test('rejects unauthenticated request with 401', () => {
    const check = requireRole(null, 'any');
    assert.equal(check.ok, false);
    if (!check.ok) assert.equal(check.status, 401);
  });

  test('allows any authenticated user to create a session', () => {
    assert.equal(requireRole(admin, 'any').ok, true);
    assert.equal(requireRole(reviewer, 'any').ok, true);
  });
});

// Pure validation logic mirroring the POST handler
function validateAgentResponse(value: unknown): string | null {
  if (typeof value === 'string' && value.length > 50_000) {
    return 'agentResponse must be 50,000 characters or fewer';
  }
  return null;
}

describe('POST /api/operator-sessions agentResponse validation', () => {
  test('accepts agentResponse at exactly 50,000 chars', () => {
    assert.equal(validateAgentResponse('x'.repeat(50_000)), null);
  });

  test('rejects agentResponse over 50,000 chars', () => {
    const err = validateAgentResponse('x'.repeat(50_001));
    assert.ok(err?.includes('50,000'));
  });

  test('accepts undefined agentResponse', () => {
    assert.equal(validateAgentResponse(undefined), null);
  });
});
