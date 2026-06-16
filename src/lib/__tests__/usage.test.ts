import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { PLAN_LIMITS } from '../usage';

describe('PLAN_LIMITS', () => {
  test('free plan has tasks limit of 50', () => {
    assert.equal(PLAN_LIMITS.free.tasks, 50);
  });

  test('enterprise plan has Infinity tasks', () => {
    assert.equal(PLAN_LIMITS.enterprise.tasks, Infinity);
  });

  test('pro limits are higher than free', () => {
    assert.ok(PLAN_LIMITS.pro.tasks > PLAN_LIMITS.free.tasks);
    assert.ok(PLAN_LIMITS.pro.runsPerMonth > PLAN_LIMITS.free.runsPerMonth);
  });

  test('all plans have required keys', () => {
    for (const plan of Object.values(PLAN_LIMITS)) {
      assert.ok('tasks' in plan);
      assert.ok('runsPerMonth' in plan);
      assert.ok('projects' in plan);
      assert.ok('apiKeys' in plan);
    }
  });
});
