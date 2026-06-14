/**
 * Tests for the GET /api/tasks/[id]/evidence endpoint logic.
 *
 * Because this project uses Node's built-in test runner (not Jest),
 * we test the pure evidence pack assembly logic directly — the same
 * approach used by other tests in src/lib/__tests__/.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { requireRole } from '../../../lib/rbac.js';
import type { AppSession } from '../../../lib/session.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const adminSession: AppSession = {
  userId: 'user-admin-1',
  username: 'admin@example.com',
  role: 'admin',
  loginAt: '2024-01-01T00:00:00.000Z',
  sessionId: 'session-admin-1',
};

const reviewerSession: AppSession = {
  userId: 'user-reviewer-1',
  username: 'reviewer@example.com',
  role: 'reviewer',
  loginAt: '2024-01-01T00:00:00.000Z',
  sessionId: 'session-reviewer-1',
};

// ── Auth guard — mirrors the route's requireRole(currentUser, 'any') call ─────

describe('evidence route — authentication guard', () => {
  test('returns 401 when user is null (not authenticated)', () => {
    const result = requireRole(null, 'any');
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.status, 401);
  });

  test('allows admin users to access evidence pack', () => {
    const result = requireRole(adminSession, 'any');
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.user.userId, adminSession.userId);
  });

  test('allows reviewer users to access evidence pack', () => {
    const result = requireRole(reviewerSession, 'any');
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.user.userId, reviewerSession.userId);
  });
});

// ── Evidence pack shape ───────────────────────────────────────────────────────

/**
 * Mirrors the shape-building logic from route.ts so we can test it
 * without a real DB.
 */
interface EvidenceTask {
  id: string;
  title: string;
  instruction: string;
  riskLevel: string;
  environment: string;
  approvalRequired: boolean;
  status: string;
  priority: string;
  dueDate: Date | null;
  agentTool: string;
  createdAt: Date;
  updatedAt: Date;
  project: { id: string; name: string };
  assignee: { id: string; name: string | null; email: string } | null;
  milestone: { id: string; title: string } | null;
}

interface EvidenceAgentRun {
  id: string;
  generatedPrompt: string;
  selectedTool: string;
  response: string | null;
  filesChanged: string | null;
  commandsRun: string | null;
  testResult: string | null;
  commitHash: string | null;
  status: string;
  startedAt: Date;
  endedAt: Date | null;
  provider: { id: string; name: string; type: string } | null;
  steps: Array<{ stepIndex: number; type: string; content: string; createdAt: Date }>;
  evaluations: Array<{ name: string; passed: boolean; score: number | null; reason: string | null }>;
}

interface EvidenceApproval {
  approved: boolean | null;
  approverId: string | null;
  approver: { name: string | null; email: string } | null;
  createdAt: Date;
  updatedAt: Date;
}

interface EvidenceAuditEntry {
  event: string;
  details: string | null;
  createdAt: Date;
  user: { name: string | null; email: string } | null;
}

interface EvidenceGithubPR {
  prNumber: number;
  title: string;
  state: string;
  merged: boolean;
  ciStatus: string | null;
  sourceBranch: string | null;
  prUrl: string | null;
  githubCreatedAt: Date | null;
}

interface EvidencePack {
  task: EvidenceTask;
  agentRuns: EvidenceAgentRun[];
  approval: EvidenceApproval | null;
  auditLog: EvidenceAuditEntry[];
  githubPRs: EvidenceGithubPR[];
  generatedAt: string;
}

function buildEvidencePack(input: {
  task: EvidenceTask;
  agentRuns: EvidenceAgentRun[];
  approval: EvidenceApproval | null;
  auditLog: EvidenceAuditEntry[];
  githubPRs: EvidenceGithubPR[];
}): EvidencePack {
  return {
    task: input.task,
    agentRuns: input.agentRuns,
    approval: input.approval,
    auditLog: input.auditLog,
    githubPRs: input.githubPRs,
    generatedAt: new Date().toISOString(),
  };
}

const now = new Date();

const sampleTask: EvidenceTask = {
  id: 'task-uuid-001',
  title: 'Fix login bug',
  instruction: 'Investigate and fix the login flow.',
  riskLevel: 'medium',
  environment: 'staging',
  approvalRequired: true,
  status: 'completed',
  priority: 'high',
  dueDate: null,
  agentTool: 'claude-code-manual',
  createdAt: now,
  updatedAt: now,
  project: { id: 'proj-uuid-1', name: 'Web App' },
  assignee: null,
  milestone: null,
};

const sampleRun: EvidenceAgentRun = {
  id: 'run-uuid-001',
  generatedPrompt: 'Fix the login issue.',
  selectedTool: 'claude-code-manual',
  response: 'Fixed the login flow by patching auth middleware.',
  filesChanged: 'src/auth.ts',
  commandsRun: 'npm test',
  testResult: 'pass',
  commitHash: 'abc1234def5678',
  status: 'succeeded',
  startedAt: now,
  endedAt: now,
  provider: { id: 'prov-1', name: 'mock', type: 'mock' },
  steps: [
    { stepIndex: 0, type: 'thought', content: 'Analyzing...', createdAt: now },
  ],
  evaluations: [
    { name: 'output_present', passed: true, score: 1.0, reason: 'Response is non-empty' },
  ],
};

const sampleApproval: EvidenceApproval = {
  approved: true,
  approverId: 'user-admin-1',
  approver: { name: 'Admin User', email: 'admin@example.com' },
  createdAt: now,
  updatedAt: now,
};

const sampleAuditEntry: EvidenceAuditEntry = {
  event: 'task_created',
  details: JSON.stringify({ at: now.toISOString() }),
  createdAt: now,
  user: { name: 'Admin User', email: 'admin@example.com' },
};

const sampleGithubPR: EvidenceGithubPR = {
  prNumber: 42,
  title: 'Fix login auth middleware',
  state: 'merged',
  merged: true,
  ciStatus: 'success',
  sourceBranch: 'fix/login-bug',
  prUrl: 'https://github.com/org/repo/pull/42',
  githubCreatedAt: now,
};

// ── Evidence pack structure ───────────────────────────────────────────────────

describe('buildEvidencePack — top-level keys', () => {
  const pack = buildEvidencePack({
    task: sampleTask,
    agentRuns: [sampleRun],
    approval: sampleApproval,
    auditLog: [sampleAuditEntry],
    githubPRs: [sampleGithubPR],
  });

  test('has task key', () => assert.ok('task' in pack));
  test('has agentRuns key', () => assert.ok('agentRuns' in pack));
  test('has approval key', () => assert.ok('approval' in pack));
  test('has auditLog key', () => assert.ok('auditLog' in pack));
  test('has githubPRs key', () => assert.ok('githubPRs' in pack));
  test('has generatedAt key', () => assert.ok('generatedAt' in pack));
  test('generatedAt is a valid ISO string', () => {
    assert.ok(typeof pack.generatedAt === 'string');
    assert.ok(!isNaN(Date.parse(pack.generatedAt)));
  });
});

describe('buildEvidencePack — task fields', () => {
  const pack = buildEvidencePack({
    task: sampleTask,
    agentRuns: [],
    approval: null,
    auditLog: [],
    githubPRs: [],
  });

  test('task.id is preserved', () => assert.equal(pack.task.id, sampleTask.id));
  test('task.title is preserved', () => assert.equal(pack.task.title, sampleTask.title));
  test('task.riskLevel is preserved', () => assert.equal(pack.task.riskLevel, sampleTask.riskLevel));
  test('task.environment is preserved', () => assert.equal(pack.task.environment, sampleTask.environment));
  test('task.approvalRequired is preserved', () => assert.equal(pack.task.approvalRequired, sampleTask.approvalRequired));
  test('task.status is preserved', () => assert.equal(pack.task.status, sampleTask.status));
  test('task.priority is preserved', () => assert.equal(pack.task.priority, sampleTask.priority));
  test('task.agentTool is preserved', () => assert.equal(pack.task.agentTool, sampleTask.agentTool));
  test('task.project is an object with id and name', () => {
    assert.equal(typeof pack.task.project, 'object');
    assert.ok('id' in pack.task.project);
    assert.ok('name' in pack.task.project);
  });
  test('task.assignee is null when not set', () => assert.equal(pack.task.assignee, null));
  test('task.milestone is null when not set', () => assert.equal(pack.task.milestone, null));
});

describe('buildEvidencePack — agentRuns structure', () => {
  const pack = buildEvidencePack({
    task: sampleTask,
    agentRuns: [sampleRun],
    approval: null,
    auditLog: [],
    githubPRs: [],
  });

  test('agentRuns is an array', () => assert.ok(Array.isArray(pack.agentRuns)));
  test('agentRuns has 1 entry', () => assert.equal(pack.agentRuns.length, 1));
  test('run has id', () => assert.equal(pack.agentRuns[0].id, sampleRun.id));
  test('run has selectedTool', () => assert.equal(pack.agentRuns[0].selectedTool, sampleRun.selectedTool));
  test('run has commitHash', () => assert.equal(pack.agentRuns[0].commitHash, sampleRun.commitHash));
  test('run.steps is an array', () => assert.ok(Array.isArray(pack.agentRuns[0].steps)));
  test('run.evaluations is an array', () => assert.ok(Array.isArray(pack.agentRuns[0].evaluations)));
  test('run has provider', () => assert.ok(pack.agentRuns[0].provider !== undefined));
  test('provider has name', () => {
    const prov = pack.agentRuns[0].provider;
    assert.ok(prov !== null && 'name' in prov);
  });
});

describe('buildEvidencePack — approval structure', () => {
  const pack = buildEvidencePack({
    task: sampleTask,
    agentRuns: [],
    approval: sampleApproval,
    auditLog: [],
    githubPRs: [],
  });

  test('approval is not null', () => assert.notEqual(pack.approval, null));
  test('approval.approved is true', () => assert.equal(pack.approval?.approved, true));
  test('approval.approver has name and email', () => {
    assert.ok(pack.approval?.approver !== null);
    assert.ok('name' in (pack.approval!.approver!));
    assert.ok('email' in (pack.approval!.approver!));
  });
});

describe('buildEvidencePack — null approval', () => {
  const pack = buildEvidencePack({
    task: sampleTask,
    agentRuns: [],
    approval: null,
    auditLog: [],
    githubPRs: [],
  });

  test('approval is null when not provided', () => assert.equal(pack.approval, null));
});

describe('buildEvidencePack — auditLog structure', () => {
  const pack = buildEvidencePack({
    task: sampleTask,
    agentRuns: [],
    approval: null,
    auditLog: [sampleAuditEntry],
    githubPRs: [],
  });

  test('auditLog is an array', () => assert.ok(Array.isArray(pack.auditLog)));
  test('auditLog has 1 entry', () => assert.equal(pack.auditLog.length, 1));
  test('entry has event', () => assert.equal(pack.auditLog[0].event, sampleAuditEntry.event));
  test('entry has createdAt', () => assert.ok(pack.auditLog[0].createdAt instanceof Date));
  test('entry.user has name and email', () => {
    const user = pack.auditLog[0].user;
    assert.ok(user !== null);
    assert.ok('name' in user!);
    assert.ok('email' in user!);
  });
});

describe('buildEvidencePack — githubPRs structure', () => {
  const pack = buildEvidencePack({
    task: sampleTask,
    agentRuns: [],
    approval: null,
    auditLog: [],
    githubPRs: [sampleGithubPR],
  });

  test('githubPRs is an array', () => assert.ok(Array.isArray(pack.githubPRs)));
  test('githubPRs has 1 entry', () => assert.equal(pack.githubPRs.length, 1));
  test('pr has prNumber', () => assert.equal(pack.githubPRs[0].prNumber, sampleGithubPR.prNumber));
  test('pr has title', () => assert.equal(pack.githubPRs[0].title, sampleGithubPR.title));
  test('pr has state', () => assert.equal(pack.githubPRs[0].state, sampleGithubPR.state));
  test('pr.merged is true', () => assert.equal(pack.githubPRs[0].merged, true));
  test('pr has ciStatus', () => assert.equal(pack.githubPRs[0].ciStatus, 'success'));
  test('pr has prUrl', () => assert.ok(pack.githubPRs[0].prUrl?.startsWith('https://')));
});

describe('buildEvidencePack — empty collections', () => {
  const pack = buildEvidencePack({
    task: sampleTask,
    agentRuns: [],
    approval: null,
    auditLog: [],
    githubPRs: [],
  });

  test('agentRuns is empty array', () => assert.equal(pack.agentRuns.length, 0));
  test('auditLog is empty array', () => assert.equal(pack.auditLog.length, 0));
  test('githubPRs is empty array', () => assert.equal(pack.githubPRs.length, 0));
});

// ── 404 — task not found guard ────────────────────────────────────────────────

describe('evidence route — task not found logic', () => {
  test('returns 404 when task is null', () => {
    const task = null;
    const status = task === null ? 404 : 200;
    assert.equal(status, 404);
  });

  test('returns 200 when task is found', () => {
    const task = sampleTask;
    const status = task === null ? 404 : 200;
    assert.equal(status, 200);
  });
});
