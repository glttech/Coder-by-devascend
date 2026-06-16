import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// ── Health response shape tests ─────────────────────────────────────────────
// These tests validate the shape of the health response object without
// requiring a database connection or full route integration.

interface HealthResponse {
  status: 'ok' | 'degraded';
  db: 'ok' | 'error';
  version: string;
  uptimeSeconds: number;
}

function buildHealthResponse(dbOk: boolean): HealthResponse {
  return {
    status: dbOk ? 'ok' : 'degraded',
    db: dbOk ? 'ok' : 'error',
    version: process.env.npm_package_version ?? 'unknown',
    uptimeSeconds: process.uptime(),
  };
}

describe('health response shape', () => {
  test('has status, db, version, and uptimeSeconds fields when DB is healthy', () => {
    const response = buildHealthResponse(true);
    assert.ok('status' in response);
    assert.ok('db' in response);
    assert.ok('version' in response);
    assert.ok('uptimeSeconds' in response);
  });

  test('status is ok and db is ok when database is healthy', () => {
    const response = buildHealthResponse(true);
    assert.equal(response.status, 'ok');
    assert.equal(response.db, 'ok');
  });

  test('status is degraded and db is error when database is unhealthy', () => {
    const response = buildHealthResponse(false);
    assert.equal(response.status, 'degraded');
    assert.equal(response.db, 'error');
  });

  test('uptimeSeconds is a non-negative number', () => {
    const response = buildHealthResponse(true);
    assert.equal(typeof response.uptimeSeconds, 'number');
    assert.ok(response.uptimeSeconds >= 0);
  });

  test('version is a string', () => {
    const response = buildHealthResponse(true);
    assert.equal(typeof response.version, 'string');
  });
});
