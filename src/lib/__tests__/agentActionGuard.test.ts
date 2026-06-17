/**
 * Tests for the Unauthorized Agent Action Guard (PR 2.5).
 * Uses node:test — NOT Jest. Pure functions — no DB, no network.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  guardPrAction,
  guardNoApprovalByAgent,
  guardTaskScope,
  guardAgentRunScope,
} from '../agentActionGuard.js';
import type { AgentActionContext } from '../agentActionGuard.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const CTX: AgentActionContext = {
  taskId: 'task-abc',
  agentRunId: 'run-xyz',
  ownedPrNumbers: [42, 99],
  authorisedRepo: 'glttech/coder',
};

const CTX_NO_REPO: AgentActionContext = {
  ...CTX,
  authorisedRepo: null,
  ownedPrNumbers: [],
};

// ---------------------------------------------------------------------------
// guardPrAction
// ---------------------------------------------------------------------------

describe('guardPrAction', () => {
  it('allows action on an owned PR in the authorised repo', () => {
    const result = guardPrAction(CTX, 'glttech/coder', 42);
    assert.equal(result.ok, true);
  });

  it('allows action on another owned PR', () => {
    const result = guardPrAction(CTX, 'glttech/coder', 99);
    assert.equal(result.ok, true);
  });

  it('blocks action on a PR not in ownedPrNumbers', () => {
    const result = guardPrAction(CTX, 'glttech/coder', 123);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.ok(result.reason.includes('123'));
      assert.ok(result.reason.includes('AgentActionGuard'));
    }
  });

  it('blocks action when no repo is authorised', () => {
    const result = guardPrAction(CTX_NO_REPO, 'glttech/coder', 42);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.ok(result.reason.includes('not authorised'));
    }
  });

  it('blocks action on a PR in a different repo', () => {
    const result = guardPrAction(CTX, 'other-org/other-repo', 42);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.ok(result.reason.includes('other-org/other-repo'));
      assert.ok(result.reason.includes('glttech/coder'));
    }
  });

  it('reason mentions the owned PR list when blocking an unowned PR', () => {
    const result = guardPrAction(CTX, 'glttech/coder', 1000);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.ok(result.reason.includes('42'));
      assert.ok(result.reason.includes('99'));
    }
  });

  it('blocks action on PR 0 (not in owned list)', () => {
    const result = guardPrAction(CTX, 'glttech/coder', 0);
    assert.equal(result.ok, false);
  });

  it('allows empty owned list only when both checks are satisfied', () => {
    const ctxNoPrs: AgentActionContext = { ...CTX, ownedPrNumbers: [] };
    const result = guardPrAction(ctxNoPrs, 'glttech/coder', 42);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.ok(result.reason.includes('Owned PRs: []'));
    }
  });
});

// ---------------------------------------------------------------------------
// guardNoApprovalByAgent
// ---------------------------------------------------------------------------

describe('guardNoApprovalByAgent', () => {
  it('allows when agent did not attempt approval', () => {
    const result = guardNoApprovalByAgent(false);
    assert.equal(result.ok, true);
  });

  it('blocks when agent attempted to approve', () => {
    const result = guardNoApprovalByAgent(true);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.ok(result.reason.includes('human-only'));
      assert.ok(result.reason.includes('AgentActionGuard'));
    }
  });

  it('reason mentions Approval.approved', () => {
    const result = guardNoApprovalByAgent(true);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.ok(result.reason.includes('Approval.approved'));
    }
  });
});

// ---------------------------------------------------------------------------
// guardTaskScope
// ---------------------------------------------------------------------------

describe('guardTaskScope', () => {
  it('allows when resource taskId matches context taskId', () => {
    const result = guardTaskScope(CTX, 'task-abc', 'AgentRun(run-xyz)');
    assert.equal(result.ok, true);
  });

  it('blocks when resource taskId does not match', () => {
    const result = guardTaskScope(CTX, 'task-other', 'AgentRun(run-other)');
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.ok(result.reason.includes('task-other'));
      assert.ok(result.reason.includes('task-abc'));
    }
  });

  it('blocks when resource taskId is null', () => {
    const result = guardTaskScope(CTX, null, 'Instruction(instr-1)');
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.ok(result.reason.includes('no taskId'));
    }
  });

  it('blocks when resource taskId is undefined', () => {
    const result = guardTaskScope(CTX, undefined, 'EvidenceChunk');
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.ok(result.reason.includes('no taskId'));
    }
  });

  it('reason includes the resource label', () => {
    const result = guardTaskScope(CTX, 'task-other', 'MyResource');
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.ok(result.reason.includes('MyResource'));
    }
  });
});

// ---------------------------------------------------------------------------
// guardAgentRunScope
// ---------------------------------------------------------------------------

describe('guardAgentRunScope', () => {
  it('allows when target matches own agent run ID', () => {
    const result = guardAgentRunScope(CTX, 'run-xyz');
    assert.equal(result.ok, true);
  });

  it('blocks when target is a different agent run ID', () => {
    const result = guardAgentRunScope(CTX, 'run-other');
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.ok(result.reason.includes('run-other'));
      assert.ok(result.reason.includes('run-xyz'));
    }
  });

  it('reason mentions the AgentActionGuard prefix', () => {
    const result = guardAgentRunScope(CTX, 'run-sibling');
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.ok(result.reason.includes('[AgentActionGuard]'));
    }
  });
});
