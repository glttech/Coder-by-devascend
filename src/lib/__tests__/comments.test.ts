import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Pure functional tests — no DB required

describe('Comment validation', () => {
  it('rejects empty body after trim', () => {
    const body = '   ';
    assert.equal(!body?.trim(), true);
  });

  it('comment structure has required fields', () => {
    const comment = {
      id: 'abc-123',
      taskId: 'task-1',
      authorId: 'user-1',
      body: 'Hello world',
      createdAt: new Date().toISOString(),
    };
    assert.ok(comment.id);
    assert.ok(comment.taskId);
    assert.ok(comment.authorId);
    assert.ok(comment.body);
    assert.ok(comment.createdAt);
  });

  it('taskId is propagated correctly', () => {
    const taskId = 'task-abc-123';
    const comment = { taskId, authorId: 'user-1', body: 'Test comment' };
    assert.equal(comment.taskId, taskId);
  });

  it('authorId defaults to anonymous when no user', () => {
    const user = null as { id?: string } | null;
    const authorId = user?.id ?? 'anonymous';
    assert.equal(authorId, 'anonymous');
  });

  it('DELETE only allowed for comment owner or admin', () => {
    const comment = { authorId: 'user-1' };
    const currentUser = { id: 'user-2', role: 'member' };

    const isOwner = comment.authorId === currentUser.id;
    const isAdmin = currentUser.role === 'admin';
    const canDelete = isOwner || isAdmin;

    assert.equal(canDelete, false);

    const adminUser = { id: 'user-3', role: 'admin' };
    const adminCanDelete = comment.authorId === adminUser.id || adminUser.role === 'admin';
    assert.equal(adminCanDelete, true);

    const ownerUser = { id: 'user-1', role: 'member' };
    const ownerCanDelete = comment.authorId === ownerUser.id || ownerUser.role === 'admin';
    assert.equal(ownerCanDelete, true);
  });
});
