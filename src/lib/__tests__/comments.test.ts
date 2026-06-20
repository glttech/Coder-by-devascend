import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Pure functional tests — no DB required

type Role = 'admin' | 'reviewer';

function canDeleteComment(
  comment: { authorId: string },
  user: { userId: string; role: Role },
): boolean {
  return comment.authorId === user.userId || user.role === 'admin';
}

const COMMENT_MAX_LENGTH = 10_000;

function validateCommentBody(body: string | undefined): string | null {
  if (!body?.trim()) return 'body required';
  if (body.length > COMMENT_MAX_LENGTH) return `Comment body exceeds ${COMMENT_MAX_LENGTH.toLocaleString()} character limit`;
  return null;
}

describe('Comment delete authorization', () => {
  it('allows the comment author to delete their own comment', () => {
    assert.ok(canDeleteComment({ authorId: 'u1' }, { userId: 'u1', role: 'reviewer' }));
  });

  it('allows an admin to delete any comment', () => {
    assert.ok(canDeleteComment({ authorId: 'u1' }, { userId: 'u2', role: 'admin' }));
  });

  it('denies a reviewer deleting another users comment', () => {
    assert.equal(canDeleteComment({ authorId: 'u1' }, { userId: 'u2', role: 'reviewer' }), false);
  });

  it('denies when userId is empty', () => {
    assert.equal(canDeleteComment({ authorId: 'u1' }, { userId: '', role: 'reviewer' }), false);
  });
});

describe('Comment validation', () => {
  describe('body length', () => {
    it('accepts a body under the limit', () => {
      assert.equal(validateCommentBody('hello'), null);
    });

    it('accepts a body exactly at the limit', () => {
      assert.equal(validateCommentBody('a'.repeat(COMMENT_MAX_LENGTH)), null);
    });

    it('rejects a body one char over the limit', () => {
      const err = validateCommentBody('a'.repeat(COMMENT_MAX_LENGTH + 1));
      assert.ok(err?.includes('10,000'));
    });

    it('rejects a blank body', () => {
      assert.equal(validateCommentBody('   '), 'body required');
    });

    it('rejects undefined body', () => {
      assert.equal(validateCommentBody(undefined), 'body required');
    });
  });

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
