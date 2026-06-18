/**
 * Tests for GET /api/tasks/[id]/evidence — Change Control Pack endpoint.
 *
 * These tests exercise the auth guard and response-shaping logic in isolation
 * (no real database or Next.js runtime required).
 *
 * Uses Node.js built-in test runner (node:test) — consistent with the project.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { requireRole } from '../../../lib/rbac.js';
import type { AppSession } from '../../../lib/session.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const adminUser: AppSession = {
  userId: 'user-admin-1',
  username: 'admin@example.com',
  role: 'admin',
  loginAt: '2024-01-01T00:00:00.000Z',
  sessionId: 'session-admin-1',
};

const baseTask = {
  id: 'task-abc',
  title: 'Refactor auth middleware',
  instruction: 'Refactor the auth middleware to use the new session library.',
  riskLevel: 'medium',
  environment: 'staging',
  approvalRequired: true,
  status: 'completed',
  priority: 'high',
  dueDate: null as Date | null,
  agentTool: 'claude-code-manual',
  createdAt: new Date('2024-06-01T10:00:00.000Z'),
  updatedAt: new Date('2024-06-02T15:00:00.000Z'),
  projectId: 'proj-1',
  project: { id: 'proj-1', name: 'Platform' },
  assignee: { id: 'user-1', name: 'Alice', email: 'alice@example.com' },
  milestone: null as { id: string; title: string } | null,
  agentRuns: [
    {
      id: 'run-1',
      generatedPrompt: 'Refactor the middleware to use the new session library...',
      selectedTool: 'claude-code-manual',
      response: 'Done. Files updated.',
      filesChanged: 'src/middleware.ts',
      commandsRun: 'npm run test',
      testResult: 'pass',
      commitHash: 'abc1234',
      status: 'succeeded',
      startedAt: new Date('2024-06-01T10:05:00.000Z'),
      endedAt: new Date('2024-06-01T10:10:00.000Z'),
      provider: { id: 'prov-1', name: 'Claude', type: 'claude' },
      steps: [] as unknown[],
      evaluations: [{ name: 'security', passed: true, score: 1, reason: 'No issues found' }],
    },
  ],
  approval: {
    approved: true as boolean | null,
    approverId: 'user-admin-1',
    user: { name: 'Admin', email: 'admin@example.com' },
    createdAt: new Date('2024-06-02T12:00:00.000Z'),
    updatedAt: new Date('2024-06-02T12:00:00.000Z'),
  } as {
    approved: boolean | null;
    approverId: string | null;
    user: { name: string | null; email: string } | null;
    createdAt: Date;
    updatedAt: Date;
  } | null,
  audits: [
    {
      event: 'task_created',
      details: null as string | null,
      createdAt: new Date('2024-06-01T10:00:00.000Z'),
      user: { name: 'Alice', email: 'alice@example.com' } as { name: string | null; email: string } | null,
    },
    {
      event: 'approval_granted',
      details: 'Approved by admin',
      createdAt: new Date('2024-06-02T12:00:00.000Z'),
      user: { name: 'Admin', email: 'admin@example.com' } as { name: string | null; email: string } | null,
    },
  ],
};

const baseGithubPRs = [
  {
    prNumber: 42,
    title: 'Refactor auth middleware',
    state: 'closed',
    merged: true,
    ciStatus: 'success',
    sourceBranch: 'feat/auth-middleware',
    prUrl: 'https://github.com/org/repo/pull/42',
    githubCreatedAt: new Date('2024-06-01T11:00:00.000Z'),
  },
];

// ── Simulate handler logic ────────────────────────────────────────────────────
// We replicate the handler's auth-check and shaping logic rather than
// importing the route module, because Next.js route handlers pull in
// 'next/headers' which cannot be loaded outside the Next.js runtime.

type Task = typeof baseTask;
type GithubPR = typeof baseGithubPRs[number];

async function runEvidenceHandler(opts: {
  user: AppSession | null;
  task: Task | null;
  githubPRs?: GithubPR[];
}): Promise<{ status: number; body: unknown }> {
  const roleCheck = requireRole(opts.user, 'any');
  if (!roleCheck.ok) {
    return {
      status: roleCheck.status,
      body: { error: roleCheck.status === 401 ? 'Unauthorized' : 'Forbidden' },
    };
  }

  if (!opts.task) {
    return { status: 404, body: { error: 'Task not found' } };
  }

  const task = opts.task;
  const githubPRs = opts.githubPRs ?? [];

  const { agentRuns, approval, audits, project, assignee, milestone, ...taskFields } = task;

  return {
    status: 200,
    body: {
      task: {
        id: taskFields.id,
        title: taskFields.title,
        instruction: taskFields.instruction,
        riskLevel: taskFields.riskLevel,
        environment: taskFields.environment,
        approvalRequired: taskFields.approvalRequired,
        status: taskFields.status,
        priority: taskFields.priority,
        dueDate: taskFields.dueDate,
        agentTool: taskFields.agentTool,
        createdAt: taskFields.createdAt,
        updatedAt: taskFields.updatedAt,
        project,
        assignee,
        milestone,
      },
      agentRuns: agentRuns.map((run) => ({
        id: run.id,
        generatedPrompt: run.generatedPrompt,
        selectedTool: run.selectedTool,
        response: run.response,
        filesChanged: run.filesChanged,
        commandsRun: run.commandsRun,
        testResult: run.testResult,
        commitHash: run.commitHash,
        status: run.status,
        startedAt: run.startedAt,
        endedAt: run.endedAt,
        provider: run.provider,
        steps: run.steps,
        evaluations: run.evaluations,
      })),
      approval: approval
        ? {
            approved: approval.approved,
            approverId: approval.approverId,
            approver: approval.user,
            createdAt: approval.createdAt,
            updatedAt: approval.updatedAt,
          }
        : null,
      auditLog: audits.map((log) => ({
        event: log.event,
        details: log.details,
        createdAt: log.createdAt,
        user: log.user,
      })),
      githubPRs,
      generatedAt: new Date().toISOString(),
    },
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GET /api/tasks/[id]/evidence — auth guard', () => {
  test('returns 401 when getCurrentUser returns null', async () => {
    const result = await runEvidenceHandler({ user: null, task: baseTask });
    assert.equal(result.status, 401);
    assert.deepEqual(result.body, { error: 'Unauthorized' });
  });
});

describe('GET /api/tasks/[id]/evidence — task lookup', () => {
  test('returns 404 when task does not exist', async () => {
    const result = await runEvidenceHandler({ user: adminUser, task: null });
    assert.equal(result.status, 404);
    assert.deepEqual(result.body, { error: 'Task not found' });
  });
});

describe('GET /api/tasks/[id]/evidence — evidence pack shape', () => {
  test('returns 200 with all required top-level keys', async () => {
    const result = await runEvidenceHandler({ user: adminUser, task: baseTask, githubPRs: baseGithubPRs });
    assert.equal(result.status, 200);
    const body = result.body as Record<string, unknown>;
    assert.ok('task' in body, 'must include task');
    assert.ok('agentRuns' in body, 'must include agentRuns');
    assert.ok('approval' in body, 'must include approval');
    assert.ok('auditLog' in body, 'must include auditLog');
    assert.ok('githubPRs' in body, 'must include githubPRs');
    assert.ok('generatedAt' in body, 'must include generatedAt');
  });

  test('task shape has expected fields', async () => {
    const result = await runEvidenceHandler({ user: adminUser, task: baseTask });
    const body = result.body as Record<string, unknown>;
    const task = body.task as Record<string, unknown>;
    assert.equal(task.id, 'task-abc');
    assert.equal(task.title, 'Refactor auth middleware');
    assert.equal(task.riskLevel, 'medium');
    assert.equal(task.status, 'completed');
    assert.equal(task.environment, 'staging');
    assert.equal(task.approvalRequired, true);
  });

  test('agentRuns contains runs with evaluations', async () => {
    const result = await runEvidenceHandler({ user: adminUser, task: baseTask });
    const body = result.body as Record<string, unknown>;
    const runs = body.agentRuns as Record<string, unknown>[];
    assert.equal(runs.length, 1, 'should have one agent run');
    assert.equal(runs[0].id, 'run-1');
    assert.equal(runs[0].commitHash, 'abc1234');
    const evals = runs[0].evaluations as Record<string, unknown>[];
    assert.equal(evals.length, 1);
    assert.equal(evals[0].passed, true);
  });

  test('approval record includes approved flag and approver', async () => {
    const result = await runEvidenceHandler({ user: adminUser, task: baseTask });
    const body = result.body as Record<string, unknown>;
    const approval = body.approval as Record<string, unknown>;
    assert.ok(approval !== null);
    assert.equal(approval.approved, true);
    const approver = approval.approver as Record<string, unknown>;
    assert.equal(approver.name, 'Admin');
  });

  test('auditLog contains all audit events in order', async () => {
    const result = await runEvidenceHandler({ user: adminUser, task: baseTask });
    const body = result.body as Record<string, unknown>;
    const auditLog = body.auditLog as Record<string, unknown>[];
    assert.equal(auditLog.length, 2);
    assert.equal(auditLog[0].event, 'task_created');
    assert.equal(auditLog[1].event, 'approval_granted');
  });

  test('githubPRs are returned correctly', async () => {
    const result = await runEvidenceHandler({ user: adminUser, task: baseTask, githubPRs: baseGithubPRs });
    const body = result.body as Record<string, unknown>;
    const prs = body.githubPRs as Record<string, unknown>[];
    assert.equal(prs.length, 1);
    assert.equal(prs[0].prNumber, 42);
    assert.equal(prs[0].merged, true);
    assert.equal(prs[0].ciStatus, 'success');
  });

  test('approval is null when task has no approval record', async () => {
    const taskWithoutApproval = { ...baseTask, approval: null };
    const result = await runEvidenceHandler({ user: adminUser, task: taskWithoutApproval });
    const body = result.body as Record<string, unknown>;
    assert.equal(body.approval, null);
  });

  test('generatedAt is a valid ISO timestamp string', async () => {
    const result = await runEvidenceHandler({ user: adminUser, task: baseTask });
    const body = result.body as Record<string, unknown>;
    const ts = body.generatedAt as string;
    assert.ok(typeof ts === 'string');
    assert.ok(!isNaN(Date.parse(ts)), 'generatedAt must be a valid ISO date');
  });
});
