import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCoderTaskParams } from '../coder/taskParams.js';

describe('parseCoderTaskParams — limit', () => {
  test('defaults to 50 when limit is absent', () => {
    const { limit } = parseCoderTaskParams(new URLSearchParams());
    assert.equal(limit, 50);
  });

  test('accepts a valid limit', () => {
    const { limit } = parseCoderTaskParams(new URLSearchParams('limit=100'));
    assert.equal(limit, 100);
  });

  test('caps limit at 200', () => {
    const { limit } = parseCoderTaskParams(new URLSearchParams('limit=999'));
    assert.equal(limit, 200);
  });

  test('falls back to 50 on non-numeric limit', () => {
    const { limit } = parseCoderTaskParams(new URLSearchParams('limit=abc'));
    assert.equal(limit, 50);
  });

  test('falls back to 50 on zero limit', () => {
    const { limit } = parseCoderTaskParams(new URLSearchParams('limit=0'));
    assert.equal(limit, 50);
  });

  test('falls back to 50 on negative limit', () => {
    const { limit } = parseCoderTaskParams(new URLSearchParams('limit=-5'));
    assert.equal(limit, 50);
  });

  test('accepts limit=1 (minimum valid)', () => {
    const { limit } = parseCoderTaskParams(new URLSearchParams('limit=1'));
    assert.equal(limit, 1);
  });

  test('accepts limit=200 (maximum valid)', () => {
    const { limit } = parseCoderTaskParams(new URLSearchParams('limit=200'));
    assert.equal(limit, 200);
  });
});

describe('parseCoderTaskParams — cursor', () => {
  test('cursor is undefined when absent', () => {
    const { cursor } = parseCoderTaskParams(new URLSearchParams());
    assert.equal(cursor, undefined);
  });

  test('passes an ISO cursor through', () => {
    const iso = '2026-06-20T12:00:00.000Z';
    const { cursor } = parseCoderTaskParams(new URLSearchParams(`cursor=${iso}`));
    assert.equal(cursor, iso);
  });

  test('passes an arbitrary cursor string through', () => {
    const { cursor } = parseCoderTaskParams(new URLSearchParams('cursor=some-opaque-value'));
    assert.equal(cursor, 'some-opaque-value');
  });
});

describe('parseCoderTaskParams — status filter', () => {
  test('status is undefined when absent', () => {
    const { status } = parseCoderTaskParams(new URLSearchParams());
    assert.equal(status, undefined);
  });

  test('passes pending status', () => {
    const { status } = parseCoderTaskParams(new URLSearchParams('status=pending'));
    assert.equal(status, 'pending');
  });

  test('passes running status', () => {
    const { status } = parseCoderTaskParams(new URLSearchParams('status=running'));
    assert.equal(status, 'running');
  });

  test('passes completed status', () => {
    const { status } = parseCoderTaskParams(new URLSearchParams('status=completed'));
    assert.equal(status, 'completed');
  });

  test('passes failed status', () => {
    const { status } = parseCoderTaskParams(new URLSearchParams('status=failed'));
    assert.equal(status, 'failed');
  });
});

describe('parseCoderTaskParams — projectId filter', () => {
  test('projectId is undefined when absent', () => {
    const { projectId } = parseCoderTaskParams(new URLSearchParams());
    assert.equal(projectId, undefined);
  });

  test('passes projectId through', () => {
    const id = 'proj-abc-123';
    const { projectId } = parseCoderTaskParams(new URLSearchParams(`projectId=${id}`));
    assert.equal(projectId, id);
  });
});

describe('parseCoderTaskParams — combined params', () => {
  test('parses all params together', () => {
    const params = new URLSearchParams(
      'limit=25&cursor=2026-01-01T00:00:00.000Z&status=running&projectId=p-1',
    );
    const result = parseCoderTaskParams(params);
    assert.equal(result.limit, 25);
    assert.equal(result.cursor, '2026-01-01T00:00:00.000Z');
    assert.equal(result.status, 'running');
    assert.equal(result.projectId, 'p-1');
  });

  test('limit cap does not affect other params', () => {
    const params = new URLSearchParams('limit=999&status=failed&projectId=p-2');
    const result = parseCoderTaskParams(params);
    assert.equal(result.limit, 200);
    assert.equal(result.status, 'failed');
    assert.equal(result.projectId, 'p-2');
  });
});
