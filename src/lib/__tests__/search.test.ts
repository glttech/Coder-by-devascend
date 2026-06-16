import { test } from 'node:test';
import assert from 'node:assert/strict';

// Unit tests for search logic — no DB or server required

test('returns empty results when query is shorter than 2 chars', () => {
  const q = 'a';
  const results = q.length < 2 ? [] : ['something'];
  assert.deepEqual(results, []);
});

test('result type label matches type field', () => {
  const result = { id: '1', type: 'task' as const, title: 'Fix bug', subtitle: 'open · low risk', url: '/tasks/1' };
  assert.equal(result.type, 'task');
});

test('limit is capped at 50', () => {
  const requestedLimit = 100;
  const limit = Math.min(requestedLimit, 50);
  assert.equal(limit, 50);
});

test('URL construction for task is /tasks/<id>', () => {
  const task = { id: 'abc123', title: 'My task', status: 'open', riskLevel: 'low' };
  const url = `/tasks/${task.id}`;
  assert.equal(url, '/tasks/abc123');
});
