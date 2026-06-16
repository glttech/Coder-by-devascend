import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { aggregateProjectCi } from '../ci/aggregate.js';

const makePR = (overrides: Partial<{ id: string; projectId: string; prNumber: number; title: string; ciStatus: string | null; state: string; merged: boolean; prUrl: string | null }> = {}) => ({
  id: 'pr-1',
  projectId: 'proj-1',
  prNumber: 1,
  title: 'Test PR',
  ciStatus: null,
  state: 'open',
  merged: false,
  prUrl: null,
  ...overrides,
});

describe('aggregateProjectCi', () => {
  test('no PRs returns signal=none and zeros', () => {
    const result = aggregateProjectCi('MyProject', 'proj-1', []);
    assert.equal(result.signal, 'none');
    assert.equal(result.total, 0);
    assert.equal(result.success, 0);
    assert.equal(result.failure, 0);
    assert.equal(result.pending, 0);
  });

  test('only passing PRs returns signal=green', () => {
    const prs = [makePR({ ciStatus: 'success' }), makePR({ id: 'pr-2', prNumber: 2, ciStatus: 'success' })];
    const result = aggregateProjectCi('MyProject', 'proj-1', prs);
    assert.equal(result.signal, 'green');
    assert.equal(result.success, 2);
  });

  test('one failing PR returns signal=red', () => {
    const prs = [makePR({ ciStatus: 'success' }), makePR({ id: 'pr-2', prNumber: 2, ciStatus: 'failure' })];
    const result = aggregateProjectCi('MyProject', 'proj-1', prs);
    assert.equal(result.signal, 'red');
    assert.equal(result.failure, 1);
  });

  test('only pending PRs returns signal=yellow', () => {
    const prs = [makePR({ ciStatus: 'pending' })];
    const result = aggregateProjectCi('MyProject', 'proj-1', prs);
    assert.equal(result.signal, 'yellow');
    assert.equal(result.pending, 1);
  });

  test('total only counts open non-merged PRs', () => {
    const prs = [
      makePR({ state: 'open', merged: false, ciStatus: 'success' }),
      makePR({ id: 'pr-2', prNumber: 2, state: 'closed', merged: true, ciStatus: 'success' }),
      makePR({ id: 'pr-3', prNumber: 3, state: 'closed', merged: false, ciStatus: 'success' }),
    ];
    const result = aggregateProjectCi('MyProject', 'proj-1', prs);
    assert.equal(result.total, 1);
  });

  test('project name is preserved in output', () => {
    const result = aggregateProjectCi('AwesomeProject', 'proj-42', []);
    assert.equal(result.projectName, 'AwesomeProject');
    assert.equal(result.projectId, 'proj-42');
  });
});
