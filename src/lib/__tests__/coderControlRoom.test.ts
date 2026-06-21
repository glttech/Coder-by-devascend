import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { parseControlRoomParams } from '../coder/controlRoomParams.js';

describe('parseControlRoomParams — defaults', () => {
  test('defaults orgId to org_default', () => {
    const { orgId } = parseControlRoomParams(new URLSearchParams());
    assert.equal(orgId, 'org_default');
  });

  test('defaults limit to 50', () => {
    const { limit } = parseControlRoomParams(new URLSearchParams());
    assert.equal(limit, 50);
  });

  test('repoId is undefined when absent', () => {
    const { repoId } = parseControlRoomParams(new URLSearchParams());
    assert.equal(repoId, undefined);
  });

  test('taskId is undefined when absent', () => {
    const { taskId } = parseControlRoomParams(new URLSearchParams());
    assert.equal(taskId, undefined);
  });

  test('status is undefined when absent', () => {
    const { status } = parseControlRoomParams(new URLSearchParams());
    assert.equal(status, undefined);
  });

  test('cursor is undefined when absent', () => {
    const { cursor } = parseControlRoomParams(new URLSearchParams());
    assert.equal(cursor, undefined);
  });
});

describe('parseControlRoomParams — filters', () => {
  test('passes repoId through', () => {
    const { repoId } = parseControlRoomParams(new URLSearchParams('repoId=repo-123'));
    assert.equal(repoId, 'repo-123');
  });

  test('passes taskId through', () => {
    const { taskId } = parseControlRoomParams(new URLSearchParams('taskId=task-abc'));
    assert.equal(taskId, 'task-abc');
  });

  test('passes status through', () => {
    const { status } = parseControlRoomParams(new URLSearchParams('status=running'));
    assert.equal(status, 'running');
  });

  test('passes cursor through', () => {
    const iso = '2026-06-21T10:00:00.000Z';
    const { cursor } = parseControlRoomParams(new URLSearchParams(`cursor=${iso}`));
    assert.equal(cursor, iso);
  });

  test('passes custom orgId through', () => {
    const { orgId } = parseControlRoomParams(new URLSearchParams('orgId=my-org'));
    assert.equal(orgId, 'my-org');
  });
});

describe('parseControlRoomParams — limit clamping', () => {
  test('accepts limit=1', () => {
    const { limit } = parseControlRoomParams(new URLSearchParams('limit=1'));
    assert.equal(limit, 1);
  });

  test('accepts limit=100', () => {
    const { limit } = parseControlRoomParams(new URLSearchParams('limit=100'));
    assert.equal(limit, 100);
  });

  test('clamps limit above 100 to 100', () => {
    const { limit } = parseControlRoomParams(new URLSearchParams('limit=500'));
    assert.equal(limit, 100);
  });

  test('falls back to 50 on zero', () => {
    const { limit } = parseControlRoomParams(new URLSearchParams('limit=0'));
    assert.equal(limit, 50);
  });

  test('falls back to 50 on negative', () => {
    const { limit } = parseControlRoomParams(new URLSearchParams('limit=-1'));
    assert.equal(limit, 50);
  });

  test('falls back to 50 on non-numeric', () => {
    const { limit } = parseControlRoomParams(new URLSearchParams('limit=abc'));
    assert.equal(limit, 50);
  });
});

describe('parseControlRoomParams — multi-filter', () => {
  test('parses all filters together', () => {
    const params = parseControlRoomParams(
      new URLSearchParams('repoId=r1&taskId=t1&status=running&orgId=org1&limit=25'),
    );
    assert.equal(params.repoId, 'r1');
    assert.equal(params.taskId, 't1');
    assert.equal(params.status, 'running');
    assert.equal(params.orgId, 'org1');
    assert.equal(params.limit, 25);
  });
});
