import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { runReadinessChecks } from '../releaseChecks.js';

// Baseline env that satisfies all checks in a "good" state
const goodEnv: Record<string, string | undefined> = {
  ADMIN_USERNAME: 'admin',
  ADMIN_PASSWORD_HASH: '$2b$12$abcdefghijklmnopqrstuvwxyz',
  SESSION_SECRET: 'a'.repeat(64),
  DATABASE_URL: 'postgresql://localhost:5432/coder',
  ORCHESTRATION_ENABLED: 'false',
  NODE_ENV: 'production',
};

describe('runReadinessChecks — auth config fail', () => {
  test('misconfigured auth yields fail status on auth-config check', async () => {
    // Only set username, no hash → misconfigured
    const env: Record<string, string | undefined> = {
      ...goodEnv,
      ADMIN_PASSWORD_HASH: undefined,
    };
    const report = await runReadinessChecks(env);

    const authCheck = report.checks.find((c) => c.name === 'Auth config');
    assert.ok(authCheck, 'Auth config check should be present');
    assert.equal(authCheck.status, 'fail');
  });

  test('overall status is fail when auth config fails', async () => {
    const env: Record<string, string | undefined> = {
      ...goodEnv,
      ADMIN_PASSWORD_HASH: undefined,
    };
    const report = await runReadinessChecks(env);
    assert.equal(report.overallStatus, 'fail');
  });
});

describe('runReadinessChecks — all checks pass', () => {
  test('overall pass when auth config ok and all vars set correctly', async () => {
    const report = await runReadinessChecks(goodEnv);
    assert.equal(report.overallStatus, 'pass');
  });

  test('generatedAt is an ISO timestamp string', async () => {
    const report = await runReadinessChecks(goodEnv);
    assert.ok(typeof report.generatedAt === 'string');
    // Should parse as a valid date
    const parsed = new Date(report.generatedAt);
    assert.ok(!isNaN(parsed.getTime()), 'generatedAt should be a valid ISO date string');
  });

  test('checks array is non-empty', async () => {
    const report = await runReadinessChecks(goodEnv);
    assert.ok(Array.isArray(report.checks));
    assert.ok(report.checks.length > 0);
  });
});

describe('runReadinessChecks — orchestration enabled', () => {
  test('orchestration enabled produces a warn on that check', async () => {
    const env = { ...goodEnv, ORCHESTRATION_ENABLED: 'true' };
    const report = await runReadinessChecks(env);

    const orchCheck = report.checks.find((c) => c.name === 'Orchestration flag');
    assert.ok(orchCheck, 'Orchestration flag check should be present');
    assert.equal(orchCheck.status, 'warn');
  });

  test('overall status is at least warn when orchestration is enabled (all else passing)', async () => {
    const env = { ...goodEnv, ORCHESTRATION_ENABLED: 'true' };
    const report = await runReadinessChecks(env);
    // Should be warn (not fail, not pass)
    assert.equal(report.overallStatus, 'warn');
  });
});

describe('runReadinessChecks — missing DATABASE_URL', () => {
  test('missing DATABASE_URL yields fail on that check', async () => {
    const env: Record<string, string | undefined> = {
      ...goodEnv,
      DATABASE_URL: undefined,
    };
    const report = await runReadinessChecks(env);

    const dbCheck = report.checks.find((c) => c.name === 'Database URL set');
    assert.ok(dbCheck, 'Database URL set check should be present');
    assert.equal(dbCheck.status, 'fail');
  });

  test('overall status is fail when DATABASE_URL is missing', async () => {
    const env: Record<string, string | undefined> = {
      ...goodEnv,
      DATABASE_URL: undefined,
    };
    const report = await runReadinessChecks(env);
    assert.equal(report.overallStatus, 'fail');
  });
});

describe('runReadinessChecks — overall worst status', () => {
  test('fail beats warn beats pass — fail is overall when one check fails', async () => {
    // Orchestration = warn, DATABASE_URL missing = fail
    const env: Record<string, string | undefined> = {
      ...goodEnv,
      DATABASE_URL: undefined,
      ORCHESTRATION_ENABLED: 'true',
    };
    const report = await runReadinessChecks(env);
    // Even with warn from orchestration, fail from DATABASE_URL should win
    assert.equal(report.overallStatus, 'fail');
  });

  test('warn beats pass — overall is warn when no failures but at least one warn', async () => {
    const env = { ...goodEnv, ORCHESTRATION_ENABLED: 'true' };
    const report = await runReadinessChecks(env);
    assert.equal(report.overallStatus, 'warn');
  });

  test('all pass → overall pass', async () => {
    const report = await runReadinessChecks(goodEnv);
    assert.equal(report.overallStatus, 'pass');
  });
});

describe('runReadinessChecks — session secret strength', () => {
  test('32-char secret yields warn on secret-strength check when auth enforced', async () => {
    const env = {
      ...goodEnv,
      SESSION_SECRET: 'a'.repeat(32), // exactly 32 — warn
    };
    const report = await runReadinessChecks(env);
    const secretCheck = report.checks.find((c) => c.name === 'Session secret strength');
    assert.ok(secretCheck, 'Session secret strength check should be present when auth is enforced');
    assert.equal(secretCheck.status, 'warn');
  });

  test('64-char secret yields pass on secret-strength check', async () => {
    const env = {
      ...goodEnv,
      SESSION_SECRET: 'a'.repeat(64),
    };
    const report = await runReadinessChecks(env);
    const secretCheck = report.checks.find((c) => c.name === 'Session secret strength');
    assert.ok(secretCheck);
    assert.equal(secretCheck.status, 'pass');
  });

  test('session secret strength check is absent when auth is disabled', async () => {
    // No auth vars → disabled mode
    const env: Record<string, string | undefined> = {
      DATABASE_URL: 'postgresql://localhost:5432/coder',
      NODE_ENV: 'production',
    };
    const report = await runReadinessChecks(env);
    const secretCheck = report.checks.find((c) => c.name === 'Session secret strength');
    assert.equal(secretCheck, undefined);
  });
});
