/**
 * Tests for Day 4 — Agent Role-Scoped Views.
 *
 * Covers:
 * - Role key validation (all 7 built-in roles present and well-formed)
 * - Run aggregation logic (count by role, avg risk score computation)
 *
 * Uses node:test — NOT Jest. No real DB calls.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  BUILT_IN_ROLES,
  getRole,
  listRoles,
} from '../agents/roles.js';

// ---------------------------------------------------------------------------
// Role key validation tests
// ---------------------------------------------------------------------------

const EXPECTED_ROLE_KEYS = [
  'product_analyst',
  'architect',
  'developer',
  'reviewer',
  'security_reviewer',
  'qa',
  'release_manager',
] as const;

describe('agentRoleViews — role key validation', () => {
  it('BUILT_IN_ROLES contains exactly 7 roles', () => {
    assert.equal(BUILT_IN_ROLES.length, 7, `Expected 7 built-in roles, got ${BUILT_IN_ROLES.length}`);
  });

  it('all 7 expected role keys are present', () => {
    const keys = new Set(BUILT_IN_ROLES.map((r) => r.key));
    for (const expected of EXPECTED_ROLE_KEYS) {
      assert.ok(keys.has(expected), `Missing expected role key: "${expected}"`);
    }
  });

  it('no duplicate role keys exist', () => {
    const keys = BUILT_IN_ROLES.map((r) => r.key);
    const unique = new Set(keys);
    assert.equal(unique.size, keys.length, 'Duplicate role keys detected');
  });

  it('each role has a non-empty description and purpose', () => {
    for (const role of BUILT_IN_ROLES) {
      assert.ok(
        typeof role.description === 'string' && role.description.length > 0,
        `Role "${role.key}" is missing a description`,
      );
      assert.ok(
        typeof role.purpose === 'string' && role.purpose.length > 0,
        `Role "${role.key}" is missing a purpose`,
      );
    }
  });

  it('listRoles() returns the same set as BUILT_IN_ROLES', () => {
    const listed = listRoles();
    assert.equal(listed.length, BUILT_IN_ROLES.length);
    const listedKeys = new Set(listed.map((r) => r.key));
    const builtinKeys = new Set(BUILT_IN_ROLES.map((r) => r.key));
    for (const k of builtinKeys) {
      assert.ok(listedKeys.has(k), `Key "${k}" in BUILT_IN_ROLES but not in listRoles()`);
    }
  });

  it('getRole returns undefined for unknown keys (safety check for dashboard 404 logic)', () => {
    assert.equal(getRole('unknown_role'), undefined);
    assert.equal(getRole(''), undefined);
    assert.equal(getRole('PRODUCT_ANALYST'), undefined, 'Keys are case-sensitive');
  });

  it('all roles have a modelPref string (needed for role detail display)', () => {
    for (const role of BUILT_IN_ROLES) {
      assert.ok(
        typeof role.modelPref === 'string' && role.modelPref.length > 0,
        `Role "${role.key}" must have a modelPref`,
      );
    }
  });

  it('all roles have a non-empty allowedTools array (needed for role detail display)', () => {
    for (const role of BUILT_IN_ROLES) {
      assert.ok(
        Array.isArray(role.allowedTools) && role.allowedTools.length > 0,
        `Role "${role.key}" must have at least one allowedTool`,
      );
    }
  });
});

// ---------------------------------------------------------------------------
// Run aggregation logic tests (pure functions, no DB)
// ---------------------------------------------------------------------------

/**
 * Simulates what prisma.agentRun.groupBy returns for avg risk score computation.
 * We test the pure aggregation helpers used by the /agent-roles pages.
 */

type RunRecord = {
  roleKey: string | null;
  status: string;
  riskScore: number | null;
};

/** Computes run count and avg risk score per roleKey — mirrors the page's logic. */
function aggregateByRole(runs: RunRecord[]): Map<
  string,
  { count: number; avgRisk: number | null }
> {
  const result = new Map<string, { count: number; totalRisk: number; riskCount: number }>();

  for (const run of runs) {
    if (!run.roleKey) continue;
    const entry = result.get(run.roleKey) ?? { count: 0, totalRisk: 0, riskCount: 0 };
    entry.count++;
    if (run.riskScore !== null) {
      entry.totalRisk += run.riskScore;
      entry.riskCount++;
    }
    result.set(run.roleKey, entry);
  }

  return new Map(
    [...result.entries()].map(([key, { count, totalRisk, riskCount }]) => [
      key,
      { count, avgRisk: riskCount > 0 ? totalRisk / riskCount : null },
    ]),
  );
}

/** Counts runs by status within a roleKey group — mirrors stat card logic. */
function countByStatus(runs: RunRecord[], roleKey: string): Record<string, number> {
  const roleRuns = runs.filter((r) => r.roleKey === roleKey);
  return {
    total:     roleRuns.length,
    succeeded: roleRuns.filter((r) => r.status === 'succeeded').length,
    failed:    roleRuns.filter((r) => r.status === 'failed').length,
    running:   roleRuns.filter((r) => r.status === 'running').length,
  };
}

describe('agentRoleViews — run aggregation logic', () => {
  const sampleRuns: RunRecord[] = [
    { roleKey: 'developer',         status: 'succeeded', riskScore: 0.2 },
    { roleKey: 'developer',         status: 'succeeded', riskScore: 0.4 },
    { roleKey: 'developer',         status: 'failed',    riskScore: 0.8 },
    { roleKey: 'security_reviewer', status: 'succeeded', riskScore: 0.6 },
    { roleKey: 'security_reviewer', status: 'running',   riskScore: null },
    { roleKey: 'qa',                status: 'failed',    riskScore: 0.3 },
    { roleKey: null,                status: 'succeeded', riskScore: 0.1 }, // no roleKey — excluded
  ];

  it('aggregateByRole counts runs correctly per roleKey', () => {
    const agg = aggregateByRole(sampleRuns);
    assert.equal(agg.get('developer')?.count, 3);
    assert.equal(agg.get('security_reviewer')?.count, 2);
    assert.equal(agg.get('qa')?.count, 1);
  });

  it('aggregateByRole excludes runs with null roleKey', () => {
    const agg = aggregateByRole(sampleRuns);
    assert.equal(agg.has(null as unknown as string), false);
    // Total keyed entries should be 3 (developer, security_reviewer, qa)
    assert.equal(agg.size, 3);
  });

  it('aggregateByRole computes avg risk score correctly', () => {
    const agg = aggregateByRole(sampleRuns);
    const devAvg = agg.get('developer')?.avgRisk;
    assert.ok(devAvg !== null && devAvg !== undefined, 'developer avgRisk should not be null');
    // (0.2 + 0.4 + 0.8) / 3 = 0.4667
    assert.ok(
      Math.abs(devAvg - (0.2 + 0.4 + 0.8) / 3) < 0.0001,
      `developer avgRisk should be ~0.467, got ${devAvg}`,
    );
  });

  it('aggregateByRole returns null avgRisk when all riskScores are null', () => {
    const runs: RunRecord[] = [
      { roleKey: 'architect', status: 'running', riskScore: null },
      { roleKey: 'architect', status: 'running', riskScore: null },
    ];
    const agg = aggregateByRole(runs);
    assert.equal(agg.get('architect')?.avgRisk, null);
  });

  it('aggregateByRole excludes null riskScores from avg computation', () => {
    // security_reviewer: riskScore 0.6 and null — avg should be 0.6 (not 0.3)
    const agg = aggregateByRole(sampleRuns);
    const secAvg = agg.get('security_reviewer')?.avgRisk;
    assert.ok(secAvg !== null && secAvg !== undefined);
    assert.ok(
      Math.abs(secAvg - 0.6) < 0.0001,
      `security_reviewer avgRisk should be 0.6 (null excluded), got ${secAvg}`,
    );
  });

  it('countByStatus returns correct counts for a given roleKey', () => {
    const counts = countByStatus(sampleRuns, 'developer');
    assert.equal(counts.total,     3);
    assert.equal(counts.succeeded, 2);
    assert.equal(counts.failed,    1);
    assert.equal(counts.running,   0);
  });

  it('countByStatus returns zeros for a roleKey with no runs', () => {
    const counts = countByStatus(sampleRuns, 'release_manager');
    assert.equal(counts.total,     0);
    assert.equal(counts.succeeded, 0);
    assert.equal(counts.failed,    0);
    assert.equal(counts.running,   0);
  });

  it('aggregateByRole handles empty input gracefully', () => {
    const agg = aggregateByRole([]);
    assert.equal(agg.size, 0);
  });

  it('countByStatus counts running status correctly', () => {
    const counts = countByStatus(sampleRuns, 'security_reviewer');
    assert.equal(counts.running, 1);
    assert.equal(counts.succeeded, 1);
    assert.equal(counts.total, 2);
  });
});
