import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { generateTaskLifecycleDiagram } from '../diagrams/taskLifecycle.js';
import { generateArchitectureDiagram } from '../diagrams/architecture.js';

const sampleTask = {
  id: 'task-1',
  title: 'Fix login bug',
  status: 'running',
  riskLevel: 'medium',
  approvalRequired: true,
  agentRuns: [{ id: 'run-1', status: 'running', startedAt: new Date() }],
  instructions: [],
};

describe('generateTaskLifecycleDiagram', () => {
  test('starts with stateDiagram-v2', () => {
    const src = generateTaskLifecycleDiagram(sampleTask);
    assert.ok(src.startsWith('stateDiagram-v2'));
  });
  test('includes pending_approval when approvalRequired', () => {
    const src = generateTaskLifecycleDiagram(sampleTask);
    assert.ok(src.includes('pending_approval'));
  });
  test('does not include pending_approval when not required', () => {
    const src = generateTaskLifecycleDiagram({ ...sampleTask, approvalRequired: false });
    assert.ok(!src.includes('pending_approval'));
  });
  test('mentions run count', () => {
    const src = generateTaskLifecycleDiagram(sampleTask);
    assert.ok(src.includes('1 run'));
  });
});

const sampleProject = {
  id: 'proj-1',
  name: 'Web App',
  repoOwner: 'acme',
  repoName: 'web',
  tasks: [
    { id: 't1', status: 'completed', environment: 'staging' },
    { id: 't2', status: 'pending', environment: 'staging' },
    { id: 't3', status: 'completed', environment: 'production' },
  ],
};

describe('generateArchitectureDiagram', () => {
  test('starts with graph TD', () => {
    const src = generateArchitectureDiagram(sampleProject);
    assert.ok(src.startsWith('graph TD'));
  });
  test('includes repo reference', () => {
    const src = generateArchitectureDiagram(sampleProject);
    assert.ok(src.includes('acme/web'));
  });
  test('includes environment nodes', () => {
    const src = generateArchitectureDiagram(sampleProject);
    assert.ok(src.includes('staging') && src.includes('production'));
  });
  test('shows task completion ratio', () => {
    const src = generateArchitectureDiagram(sampleProject);
    assert.ok(src.includes('2/3'));
  });
});
