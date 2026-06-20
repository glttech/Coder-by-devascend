import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCliSessionParams } from '../coder/sessionParams.js';

describe('parseCliSessionParams — limit', () => {
  test('defaults to 50 when absent', () => {
    assert.equal(parseCliSessionParams(new URLSearchParams()).limit, 50);
  });

  test('accepts a valid limit', () => {
    assert.equal(parseCliSessionParams(new URLSearchParams('limit=25')).limit, 25);
  });

  test('caps at 200', () => {
    assert.equal(parseCliSessionParams(new URLSearchParams('limit=500')).limit, 200);
  });

  test('falls back to 50 on non-numeric', () => {
    assert.equal(parseCliSessionParams(new URLSearchParams('limit=xyz')).limit, 50);
  });

  test('falls back to 50 on zero', () => {
    assert.equal(parseCliSessionParams(new URLSearchParams('limit=0')).limit, 50);
  });

  test('falls back to 50 on negative', () => {
    assert.equal(parseCliSessionParams(new URLSearchParams('limit=-1')).limit, 50);
  });

  test('accepts limit=1 (minimum)', () => {
    assert.equal(parseCliSessionParams(new URLSearchParams('limit=1')).limit, 1);
  });

  test('accepts limit=200 (maximum)', () => {
    assert.equal(parseCliSessionParams(new URLSearchParams('limit=200')).limit, 200);
  });
});

describe('parseCliSessionParams — cursor', () => {
  test('undefined when absent', () => {
    assert.equal(parseCliSessionParams(new URLSearchParams()).cursor, undefined);
  });

  test('passes ISO cursor through', () => {
    const iso = '2026-06-20T10:00:00.000Z';
    assert.equal(parseCliSessionParams(new URLSearchParams(`cursor=${iso}`)).cursor, iso);
  });
});

describe('parseCliSessionParams — taskId filter', () => {
  test('undefined when absent', () => {
    assert.equal(parseCliSessionParams(new URLSearchParams()).taskId, undefined);
  });

  test('passes taskId through', () => {
    assert.equal(
      parseCliSessionParams(new URLSearchParams('taskId=task-abc')).taskId,
      'task-abc',
    );
  });
});

describe('parseCliSessionParams — status filter', () => {
  test('undefined when absent', () => {
    assert.equal(parseCliSessionParams(new URLSearchParams()).status, undefined);
  });

  test('passes pending', () => {
    assert.equal(parseCliSessionParams(new URLSearchParams('status=pending')).status, 'pending');
  });

  test('passes running', () => {
    assert.equal(parseCliSessionParams(new URLSearchParams('status=running')).status, 'running');
  });

  test('passes completed', () => {
    assert.equal(
      parseCliSessionParams(new URLSearchParams('status=completed')).status,
      'completed',
    );
  });

  test('passes failed', () => {
    assert.equal(parseCliSessionParams(new URLSearchParams('status=failed')).status, 'failed');
  });

  test('passes cancelled', () => {
    assert.equal(
      parseCliSessionParams(new URLSearchParams('status=cancelled')).status,
      'cancelled',
    );
  });
});

describe('parseCliSessionParams — combined', () => {
  test('parses all params together', () => {
    const p = parseCliSessionParams(
      new URLSearchParams('limit=10&status=running&taskId=t-1&cursor=2026-06-20T00:00:00.000Z'),
    );
    assert.equal(p.limit, 10);
    assert.equal(p.status, 'running');
    assert.equal(p.taskId, 't-1');
    assert.equal(p.cursor, '2026-06-20T00:00:00.000Z');
  });

  test('limit cap does not affect other params', () => {
    const p = parseCliSessionParams(new URLSearchParams('limit=999&status=failed&taskId=t-2'));
    assert.equal(p.limit, 200);
    assert.equal(p.status, 'failed');
    assert.equal(p.taskId, 't-2');
  });
});
