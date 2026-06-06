import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeRisk, stripNegatedClauses } from '../riskAnalyzer.js';

// Adversarial fuzz suite for the risk analyzer (Backlog #10 / M-PI1).
//
// Each test represents a crafted agent response designed to suppress a real
// risk flag via negation, passive voice, or disclaimer patterns. The goal is
// to verify that stripNegatedClauses strips these attempts AND that genuine
// risky phrases still trigger correctly after stripping.

// ── Helpers ────────────────────────────────────────────────────────────────

function hasFlag(text: string, key: string): boolean {
  return analyzeRisk(text).some((f) => f.key === key);
}

function noFlag(text: string, key: string): boolean {
  return !hasFlag(text, key);
}

// ── False-positive suppression: production-environment ─────────────────────

describe('fuzz: production-environment suppression attempts', () => {
  test('"Nothing was deployed to production." — no flag', () => {
    assert.ok(noFlag('Nothing was deployed to production.', 'production-environment'));
  });

  test('"Nothing was executed in the production environment." — no flag', () => {
    assert.ok(noFlag('Nothing was executed in the production environment.', 'production-environment'));
  });

  test('"No changes were made to the production database." — no flag', () => {
    assert.ok(noFlag('No changes were made to the production database.', 'production-environment'));
  });

  test('"No production data was accessed or modified." — no flag', () => {
    assert.ok(noFlag('No production data was accessed or modified.', 'production-environment'));
  });

  test('"We have not touched the production server at all." — no flag', () => {
    assert.ok(noFlag('We have not touched the production server at all.', 'production-environment'));
  });

  test('"bypassed the production deployment step entirely" — no flag', () => {
    assert.ok(noFlag('bypassed the production deployment step entirely', 'production-environment'));
  });

  test('"I avoided touching the live production environment." — no flag', () => {
    assert.ok(noFlag('I avoided touching the live production environment.', 'production-environment'));
  });

  test('"skipped the production environment check" — no flag', () => {
    assert.ok(noFlag('skipped the production environment check', 'production-environment'));
  });
});

// ── False-positive suppression: destructive-command ───────────────────────

describe('fuzz: destructive-command suppression attempts', () => {
  test('"Nothing was deleted via rm -rf." — no flag', () => {
    assert.ok(noFlag('Nothing was deleted via rm -rf.', 'destructive-command'));
  });

  test('"No rm -rf commands were run." — no flag', () => {
    assert.ok(noFlag('No rm -rf commands were run.', 'destructive-command'));
  });

  test('"I avoided running rm -rf on the build directory." — no flag', () => {
    assert.ok(noFlag('I avoided running rm -rf on the build directory.', 'destructive-command'));
  });

  test('"skipped the git reset --hard step" — no flag', () => {
    assert.ok(noFlag('skipped the git reset --hard step', 'destructive-command'));
  });

  test('"bypassed the drop table operation in the migration" — no flag', () => {
    assert.ok(noFlag('bypassed the drop table operation in the migration', 'destructive-command'));
  });
});

// ── False-positive suppression: database-migration ────────────────────────

describe('fuzz: database-migration suppression attempts', () => {
  test('"No migration was executed." — no flag', () => {
    assert.ok(noFlag('No migration was executed.', 'database-migration'));
  });

  test('"Nothing was migrated or changed in the schema." — no flag', () => {
    assert.ok(noFlag('Nothing was migrated or changed in the schema.', 'database-migration'));
  });

  test('"I did not run prisma migrate at any point." — no flag', () => {
    assert.ok(noFlag('I did not run prisma migrate at any point.', 'database-migration'));
  });

  test('"avoided the alter table command entirely" — no flag', () => {
    assert.ok(noFlag('avoided the alter table command entirely', 'database-migration'));
  });

  test('"skipped the schema change step" — no flag', () => {
    assert.ok(noFlag('skipped the schema change step', 'database-migration'));
  });
});

// ── False-positive suppression: secrets-exposure ──────────────────────────

describe('fuzz: secrets-exposure suppression attempts', () => {
  test('"No secrets were printed or exposed." — no flag', () => {
    assert.ok(noFlag('No secrets were printed or exposed.', 'secrets-exposure'));
  });

  test('"Nothing involving api_key was logged." — no flag', () => {
    assert.ok(noFlag('Nothing involving api_key was logged.', 'secrets-exposure'));
  });

  test('"I avoided printing the token to the console." — no flag', () => {
    assert.ok(noFlag('I avoided printing the token to the console.', 'secrets-exposure'));
  });

  test('"No .env file was read or modified." — no flag', () => {
    assert.ok(noFlag('No .env file was read or modified.', 'secrets-exposure'));
  });
});

// ── False-positive suppression: auth-security-change ──────────────────────

describe('fuzz: auth-security-change suppression attempts', () => {
  test('"No authentication logic was changed." — no flag', () => {
    assert.ok(noFlag('No authentication logic was changed.', 'auth-security-change'));
  });

  test('"Nothing was modified in the auth middleware." — no flag', () => {
    assert.ok(noFlag('Nothing was modified in the auth middleware.', 'auth-security-change'));
  });

  test('"I avoided touching the JWT configuration." — no flag', () => {
    assert.ok(noFlag('I avoided touching the JWT configuration.', 'auth-security-change'));
  });

  test('"bypassed the oauth flow for this task" — no flag', () => {
    assert.ok(noFlag('bypassed the oauth flow for this task', 'auth-security-change'));
  });
});

// ── False-positive suppression: failed-ci-build ───────────────────────────

describe('fuzz: failed-ci-build suppression attempts', () => {
  test('"No build failures occurred." — no flag', () => {
    assert.ok(noFlag('No build failures occurred.', 'failed-ci-build'));
  });

  test('"Nothing failed — all tests passed." — no flag', () => {
    assert.ok(noFlag('Nothing failed — all tests passed.', 'failed-ci-build'));
  });

  test('"I did not encounter any CI failures." — no flag', () => {
    assert.ok(noFlag('I did not encounter any CI failures.', 'failed-ci-build'));
  });
});

// ── REAL risks still fire after stripping ─────────────────────────────────

describe('fuzz: real risk phrases must still trigger', () => {
  test('actual rm -rf command triggers destructive-command', () => {
    assert.ok(hasFlag('Ran rm -rf /tmp/old-data to free space.', 'destructive-command'));
  });

  test('explicit production database reference triggers production-environment', () => {
    assert.ok(hasFlag('Updated the production database with the new schema.', 'production-environment'));
  });

  test('prisma migrate triggers database-migration', () => {
    assert.ok(hasFlag('Executed prisma migrate dev to apply the schema change.', 'database-migration'));
  });

  test('api_key=value triggers secrets-exposure', () => {
    assert.ok(hasFlag('Found api_key=abc123 in the config file.', 'secrets-exposure'));
  });

  test('build failed triggers failed-ci-build', () => {
    assert.ok(hasFlag('The build failed with exit code 1 after lint errors.', 'failed-ci-build'));
  });

  test('auth middleware modification triggers auth-security-change', () => {
    assert.ok(hasFlag('Modified the authentication middleware to add rate limiting.', 'auth-security-change'));
  });

  test('Dockerfile update triggers infra-docker-ci', () => {
    assert.ok(hasFlag('Updated the Dockerfile to use node:20-alpine as the base image.', 'infra-docker-ci'));
  });

  test('mixed: negation + real risk — only real risk fires', () => {
    const text = 'No production touched. Ran rm -rf /tmp/artifacts to clean up.';
    assert.ok(noFlag(text, 'production-environment'), 'negated production should not flag');
    assert.ok(hasFlag(text, 'destructive-command'), 'real rm -rf should still flag');
  });

  test('mixed: negated migration + real auth change', () => {
    const text = 'No migration was executed. Patched the JWT signing key rotation logic.';
    assert.ok(noFlag(text, 'database-migration'), 'negated migration must not flag');
    assert.ok(hasFlag(text, 'auth-security-change'), 'JWT change must still flag');
  });

  test('long negation + real secret', () => {
    const text = 'No changes were made to the production database. api_key=leaked123 was found.';
    assert.ok(noFlag(text, 'production-environment'), 'negated production must not flag');
    assert.ok(hasFlag(text, 'secrets-exposure'), 'exposed api_key must still flag');
  });
});

// ── stripNegatedClauses unit tests for new patterns ───────────────────────

describe('stripNegatedClauses — new patterns', () => {
  test('"nothing was X" strips the phrase', () => {
    const r = stripNegatedClauses('Service is healthy. Nothing was deployed to production.');
    assert.ok(!r.includes('production'), 'production should be stripped');
    assert.ok(r.includes('healthy'), 'non-negated text preserved');
  });

  test('"nothing has been X" strips the phrase', () => {
    const r = stripNegatedClauses('Nothing has been changed in the auth layer.');
    assert.ok(!r.includes('auth'), 'auth should be stripped');
  });

  test('"avoided X" strips the phrase', () => {
    const r = stripNegatedClauses('avoided running rm -rf on any directory');
    assert.ok(!r.includes('rm'), 'rm should be stripped');
  });

  test('"bypassed X" strips the phrase', () => {
    const r = stripNegatedClauses('bypassed the production environment check');
    assert.ok(!r.includes('production'), 'production should be stripped');
  });

  test('"skipped X" strips the phrase', () => {
    const r = stripNegatedClauses('skipped the database migration step');
    assert.ok(!r.includes('migration'), 'migration should be stripped');
  });

  test('long "no X" phrase (7 words) strips fully', () => {
    const r = stripNegatedClauses('No changes were made to the production database.');
    assert.ok(!r.includes('production'), 'production should be stripped in long phrase');
  });

  test('positive assertion still preserved after new patterns', () => {
    const r = stripNegatedClauses('Deployed the service to production successfully.');
    assert.ok(r.includes('production'), 'positive production reference preserved');
  });
});
