import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { buildPrompt } from '../promptBuilder.js';

function makeTask(overrides: Partial<Parameters<typeof buildPrompt>[0]> = {}): Parameters<typeof buildPrompt>[0] {
  return {
    id: 'task-001',
    title: 'Fix login bug',
    instruction: 'Fix the crash on invalid email input in the login form.',
    projectId: 'proj-001',
    project: { name: 'Coder by DevAscend' },
    agentTool: 'claude-code-manual',
    riskLevel: 'low',
    environment: 'dev',
    approvalRequired: false,
    status: 'pending',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Parameters<typeof buildPrompt>[0];
}

describe('buildPrompt', () => {
  test('output contains all 8 required sections', () => {
    const prompt = buildPrompt(makeTask());
    const sections = [
      'Objective:',
      'Scope:',
      'Files / areas to inspect:',
      'Files / areas NOT to touch:',
      'Safety constraints:',
      'Exact expected changes:',
      'Validation commands',
      'Required final report format:',
    ];
    for (const section of sections) {
      assert.ok(prompt.includes(section), `prompt must include section: "${section}"`);
    }
  });

  test('includes the task instruction in the Objective section', () => {
    const task = makeTask({ instruction: 'Refactor the payment module.' });
    const prompt = buildPrompt(task);
    assert.ok(prompt.includes('Refactor the payment module.'), 'instruction must appear in prompt');
  });

  test('uses project name (not UUID) in Scope section', () => {
    const task = makeTask({ project: { name: 'MyApp' } });
    const prompt = buildPrompt(task);
    assert.ok(prompt.includes('MyApp'), 'project name must appear in prompt');
    assert.ok(!prompt.includes('proj-001'), 'UUID must not appear in prompt when project name is available');
  });

  test('falls back to projectId when project is null', () => {
    const task = makeTask({ project: null });
    const prompt = buildPrompt(task);
    assert.ok(prompt.includes('proj-001'), 'projectId must appear as fallback when project is null');
  });

  test('includes agent tool label in Scope section', () => {
    const task = makeTask({ agentTool: 'openclaw-manual' });
    const prompt = buildPrompt(task);
    assert.ok(prompt.includes('OpenClaw'), 'agent label must appear in prompt');
  });

  test('production environment shows strong guard text', () => {
    const task = makeTask({ environment: 'production' });
    const prompt = buildPrompt(task);
    assert.ok(
      prompt.includes('PRODUCTION ENVIRONMENT'),
      'production environment must show strong guard text',
    );
  });

  test('dev environment shows dev guard text', () => {
    const task = makeTask({ environment: 'dev' });
    const prompt = buildPrompt(task);
    assert.ok(prompt.includes('DEV environment'), 'dev environment must show correct guard text');
  });

  test('high risk level shows risk note', () => {
    const task = makeTask({ riskLevel: 'high' });
    const prompt = buildPrompt(task);
    assert.ok(prompt.includes('Risk level is HIGH'), 'high risk task must show risk note');
  });

  test('includes stop conditions in Safety constraints', () => {
    const prompt = buildPrompt(makeTask());
    assert.ok(prompt.includes('STOP if'), 'prompt must include STOP conditions in Safety constraints');
    assert.ok(prompt.includes('.env'), 'stop conditions must mention .env files');
    assert.ok(prompt.includes('migration'), 'stop conditions must mention migrations');
  });

  test('includes validation commands section with npm commands', () => {
    const prompt = buildPrompt(makeTask());
    assert.ok(prompt.includes('npm run build'), 'validation section must include npm run build');
    assert.ok(prompt.includes('npm test'), 'validation section must include npm test');
  });

  test('report format section lists required fields', () => {
    const prompt = buildPrompt(makeTask());
    assert.ok(prompt.includes('Files changed:'), 'report format must list Files changed');
    assert.ok(prompt.includes('Commands run:'), 'report format must list Commands run');
    assert.ok(prompt.includes('Commit hash:'), 'report format must list Commit hash');
  });
});
