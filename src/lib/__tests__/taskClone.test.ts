import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// Pure-function mirror of POST /api/tasks/[id]/clone logic.

interface TaskLike {
  id: string;
  title: string;
  instruction: string;
  agentTool: string;
  riskLevel: string;
  environment: string;
  approvalRequired: boolean;
  projectId: string;
}

function buildCloneTitle(sourceTitle: string): string {
  return `Copy of ${sourceTitle}`;
}

function buildCloneData(source: TaskLike): Omit<TaskLike, 'id'> {
  return {
    title: buildCloneTitle(source.title),
    instruction: source.instruction,
    agentTool: source.agentTool,
    riskLevel: source.riskLevel,
    environment: source.environment,
    approvalRequired: source.approvalRequired,
    projectId: source.projectId,
  };
}

function buildCloneAuditDetails(sourceId: string): string {
  return JSON.stringify({ sourceTaskId: sourceId, at: new Date().toISOString() });
}

const SAMPLE: TaskLike = {
  id: 'src-uuid-1234',
  title: 'Fix login bug',
  instruction: 'Investigate and fix the login flow.',
  agentTool: 'claude-code-manual',
  riskLevel: 'low',
  environment: 'dev',
  approvalRequired: true,
  projectId: 'proj-uuid-9999',
};

// ── buildCloneTitle ────────────────────────────────────────────────────────

describe('buildCloneTitle', () => {
  test('prepends "Copy of " to the original title', () => {
    assert.equal(buildCloneTitle('Fix login bug'), 'Copy of Fix login bug');
  });

  test('handles empty string title', () => {
    assert.equal(buildCloneTitle(''), 'Copy of ');
  });

  test('handles already-prefixed title (double-clone)', () => {
    assert.equal(buildCloneTitle('Copy of Fix login bug'), 'Copy of Copy of Fix login bug');
  });

  test('preserves original title exactly (no trim)', () => {
    assert.equal(buildCloneTitle('  spaces  '), 'Copy of   spaces  ');
  });
});

// ── buildCloneData — field copying ────────────────────────────────────────

describe('buildCloneData — copies correct fields', () => {
  const data = buildCloneData(SAMPLE);

  test('title is prefixed with "Copy of "', () => {
    assert.equal(data.title, 'Copy of Fix login bug');
  });

  test('instruction is copied verbatim', () => {
    assert.equal(data.instruction, SAMPLE.instruction);
  });

  test('agentTool is copied', () => {
    assert.equal(data.agentTool, SAMPLE.agentTool);
  });

  test('riskLevel is copied', () => {
    assert.equal(data.riskLevel, SAMPLE.riskLevel);
  });

  test('environment is copied', () => {
    assert.equal(data.environment, SAMPLE.environment);
  });

  test('approvalRequired is copied', () => {
    assert.equal(data.approvalRequired, SAMPLE.approvalRequired);
  });

  test('projectId is copied', () => {
    assert.equal(data.projectId, SAMPLE.projectId);
  });
});

// ── buildCloneData — excluded fields ──────────────────────────────────────

describe('buildCloneData — does NOT include relations or id', () => {
  const data = buildCloneData(SAMPLE) as Record<string, unknown>;

  test('id is not in clone data', () => {
    assert.ok(!('id' in data), 'clone data must not include source id');
  });

  test('agentRuns is not in clone data', () => {
    assert.ok(!('agentRuns' in data));
  });

  test('instructions is not in clone data', () => {
    assert.ok(!('instructions' in data));
  });

  test('approval is not in clone data', () => {
    assert.ok(!('approval' in data));
  });

  test('auditLogs is not in clone data', () => {
    assert.ok(!('auditLogs' in data));
  });

  test('status is not in clone data (inherits default "pending")', () => {
    assert.ok(!('status' in data));
  });
});

// ── buildCloneData — approvalRequired variants ────────────────────────────

describe('buildCloneData — approvalRequired variants', () => {
  test('copies approvalRequired=false correctly', () => {
    const data = buildCloneData({ ...SAMPLE, approvalRequired: false });
    assert.equal(data.approvalRequired, false);
  });

  test('copies approvalRequired=true correctly', () => {
    const data = buildCloneData({ ...SAMPLE, approvalRequired: true });
    assert.equal(data.approvalRequired, true);
  });
});

// ── buildCloneAuditDetails ─────────────────────────────────────────────────

describe('buildCloneAuditDetails', () => {
  test('returns valid JSON', () => {
    assert.doesNotThrow(() => JSON.parse(buildCloneAuditDetails('src-uuid-1234')));
  });

  test('includes sourceTaskId', () => {
    const data = JSON.parse(buildCloneAuditDetails('src-uuid-1234'));
    assert.equal(data.sourceTaskId, 'src-uuid-1234');
  });

  test('includes at timestamp', () => {
    const data = JSON.parse(buildCloneAuditDetails('src-uuid-1234'));
    assert.ok(typeof data.at === 'string');
    assert.ok(!isNaN(Date.parse(data.at)));
  });
});
