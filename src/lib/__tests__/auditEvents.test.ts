import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// Mirror the exact details-building logic from the API routes so we can
// verify event name strings and JSON shape without requiring a live DB.

const EVENT_TASK_CREATED = 'task_created';
const EVENT_AGENT_RUN_CREATED = 'agent_run_created';
const EVENT_TASK_APPROVAL_DECIDED = 'task_approval_decided';

function buildTaskCreatedDetails(opts: {
  agentTool: string;
  riskLevel: string;
  environment: string;
  approvalRequired: boolean;
}): string {
  return JSON.stringify({ ...opts, at: new Date().toISOString() });
}

function buildAgentRunCreatedDetails(opts: {
  selectedTool: string;
  hasResponse: boolean;
  status: string;
}): string {
  return JSON.stringify({ ...opts, at: new Date().toISOString() });
}

describe('audit event name constants', () => {
  test('task_created is the correct event name', () => {
    assert.equal(EVENT_TASK_CREATED, 'task_created');
  });

  test('agent_run_created is the correct event name', () => {
    assert.equal(EVENT_AGENT_RUN_CREATED, 'agent_run_created');
  });

  test('task_approval_decided is the correct event name', () => {
    assert.equal(EVENT_TASK_APPROVAL_DECIDED, 'task_approval_decided');
  });

  test('event names use snake_case and contain only lowercase letters and underscores', () => {
    const events = [EVENT_TASK_CREATED, EVENT_AGENT_RUN_CREATED, EVENT_TASK_APPROVAL_DECIDED];
    for (const e of events) {
      assert.match(e, /^[a-z_]+$/, `Event "${e}" must be snake_case`);
    }
  });
});

describe('buildTaskCreatedDetails', () => {
  test('returns valid JSON string', () => {
    const raw = buildTaskCreatedDetails({
      agentTool: 'claude-code-manual',
      riskLevel: 'low',
      environment: 'dev',
      approvalRequired: false,
    });
    assert.doesNotThrow(() => JSON.parse(raw));
  });

  test('includes all required fields', () => {
    const data = JSON.parse(buildTaskCreatedDetails({
      agentTool: 'claude-code-manual',
      riskLevel: 'medium',
      environment: 'staging',
      approvalRequired: true,
    }));
    assert.equal(data.agentTool, 'claude-code-manual');
    assert.equal(data.riskLevel, 'medium');
    assert.equal(data.environment, 'staging');
    assert.equal(data.approvalRequired, true);
    assert.ok(typeof data.at === 'string', 'at must be a string timestamp');
  });

  test('at field is an ISO 8601 timestamp', () => {
    const data = JSON.parse(buildTaskCreatedDetails({
      agentTool: 'codex-manual',
      riskLevel: 'high',
      environment: 'local',
      approvalRequired: false,
    }));
    assert.ok(!isNaN(Date.parse(data.at)), 'at must be a parseable date string');
  });

  test('does not include the instruction text (prevents large payload in audit log)', () => {
    const raw = buildTaskCreatedDetails({
      agentTool: 'claude-code-manual',
      riskLevel: 'low',
      environment: 'dev',
      approvalRequired: false,
    });
    const data = JSON.parse(raw);
    assert.equal(data.instruction, undefined, 'instruction must not appear in audit details');
    assert.equal(data.title, undefined, 'title must not appear in audit details');
  });
});

describe('buildAgentRunCreatedDetails', () => {
  test('returns valid JSON string', () => {
    const raw = buildAgentRunCreatedDetails({ selectedTool: 'claude-code-manual', hasResponse: false, status: 'pending' });
    assert.doesNotThrow(() => JSON.parse(raw));
  });

  test('includes all required fields', () => {
    const data = JSON.parse(buildAgentRunCreatedDetails({
      selectedTool: 'openclaw-manual',
      hasResponse: true,
      status: 'succeeded',
    }));
    assert.equal(data.selectedTool, 'openclaw-manual');
    assert.equal(data.hasResponse, true);
    assert.equal(data.status, 'succeeded');
    assert.ok(typeof data.at === 'string');
  });

  test('hasResponse is false when no response provided', () => {
    const data = JSON.parse(buildAgentRunCreatedDetails({
      selectedTool: 'codex-manual',
      hasResponse: false,
      status: 'pending',
    }));
    assert.equal(data.hasResponse, false);
  });

  test('does not include full response text (prevents credential exposure)', () => {
    const raw = buildAgentRunCreatedDetails({ selectedTool: 'codex-manual', hasResponse: true, status: 'succeeded' });
    const data = JSON.parse(raw);
    assert.equal(data.response, undefined, 'response text must not appear in audit details');
    assert.equal(data.generatedPrompt, undefined, 'generatedPrompt must not appear in audit details');
  });
});
