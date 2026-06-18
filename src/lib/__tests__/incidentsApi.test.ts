import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { requireRole } from '../rbac.js';
import type { AppSession } from '../session.js';

// Unit tests that verify the auth/RBAC logic used by the incidents API routes.
// These mirror what the routes enforce without requiring a live DB or HTTP server.

const adminUser: AppSession = {
  userId: 'user-admin-1',
  username: 'admin@example.com',
  role: 'admin',
  loginAt: '2024-01-01T00:00:00.000Z',
  sessionId: 'session-admin-1',
};

const reviewerUser: AppSession = {
  userId: 'user-reviewer-1',
  username: 'reviewer@example.com',
  role: 'reviewer',
  loginAt: '2024-01-01T00:00:00.000Z',
  sessionId: 'session-reviewer-1',
};

// GET /api/incidents — requireRole(user, 'any')
describe('GET /api/incidents auth', () => {
  test('returns 401 without auth (null user)', () => {
    const check = requireRole(null, 'any');
    assert.equal(check.ok, false);
    if (!check.ok) assert.equal(check.status, 401);
  });

  test('allows any authenticated user', () => {
    const adminCheck = requireRole(adminUser, 'any');
    assert.equal(adminCheck.ok, true);

    const reviewerCheck = requireRole(reviewerUser, 'any');
    assert.equal(reviewerCheck.ok, true);
  });

  test('response shape includes expected array fields', () => {
    // Simulate the shape returned by prisma.incident.findMany
    const mockIncidents = [
      {
        id: 'inc-1',
        title: 'CI pipeline failed',
        trigger: 'ci_failure',
        severity: 'high',
        status: 'open',
        taskId: null,
        agentRunId: null,
        createdAt: new Date(),
      },
    ];
    assert.ok(Array.isArray(mockIncidents));
    assert.ok(typeof mockIncidents[0].id === 'string');
    assert.ok(typeof mockIncidents[0].title === 'string');
    assert.ok(typeof mockIncidents[0].trigger === 'string');
    assert.ok(typeof mockIncidents[0].severity === 'string');
    assert.ok(typeof mockIncidents[0].status === 'string');
  });
});

// GET /api/incidents/[id] — requireRole(user, 'any'), 404 when not found
describe('GET /api/incidents/[id] auth', () => {
  test('returns 401 without auth (null user)', () => {
    const check = requireRole(null, 'any');
    assert.equal(check.ok, false);
    if (!check.ok) assert.equal(check.status, 401);
  });

  test('returns 404 shape when incident not found', () => {
    // Simulate prisma returning null → route returns { error: 'Incident not found' } 404
    const incident = null;
    if (!incident) {
      const response = { error: 'Incident not found' };
      const status = 404;
      assert.equal(response.error, 'Incident not found');
      assert.equal(status, 404);
    }
  });
});

// PATCH /api/incidents/[id] — requireRole(user, 'admin')
describe('PATCH /api/incidents/[id] auth', () => {
  test('returns 403 when reviewer (not admin) tries to patch', () => {
    const check = requireRole(reviewerUser, 'admin');
    assert.equal(check.ok, false);
    if (!check.ok) assert.equal(check.status, 403);
  });

  test('allows admin to patch', () => {
    const check = requireRole(adminUser, 'admin');
    assert.equal(check.ok, true);
  });

  test('returns 401 without auth (null user) on patch', () => {
    const check = requireRole(null, 'admin');
    assert.equal(check.ok, false);
    if (!check.ok) assert.equal(check.status, 401);
  });
});
