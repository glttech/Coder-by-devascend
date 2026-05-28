import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { generateNextPrompt, type NextPromptInput } from '../nextPromptGenerator.js';

function makeInput(overrides: Partial<NextPromptInput> = {}): NextPromptInput {
  return {
    decision: 'CONTINUE',
    riskFlags: [],
    missingEvidence: [],
    taskTitle: 'Fix the login bug',
    filesMentioned: [],
    ...overrides,
  };
}

function flag(key: string) {
  return { key, label: `Label for ${key}`, severity: 'high' as const, description: 'desc' };
}

function missing(key: string) {
  return { key, label: `Missing ${key}`, description: 'desc' };
}

describe('generateNextPrompt — CONTINUE', () => {
  test('CONTINUE includes the task title', () => {
    const prompt = generateNextPrompt(makeInput({ taskTitle: 'Refactor auth module' }));
    assert.ok(prompt.includes('Refactor auth module'), 'CONTINUE prompt must include the task title');
  });

  test('CONTINUE includes "smallest scoped change" constraint', () => {
    const prompt = generateNextPrompt(makeInput());
    assert.ok(prompt.toLowerCase().includes('smallest'), 'CONTINUE prompt must mention smallest scope');
  });

  test('CONTINUE mentions validation command', () => {
    const prompt = generateNextPrompt(makeInput());
    assert.ok(prompt.includes('validation') || prompt.includes('build') || prompt.includes('test'),
      'CONTINUE prompt must mention validation');
  });
});

describe('generateNextPrompt — BLOCKED (destructive-command)', () => {
  test('BLOCKED with destructive-command starts with STOP', () => {
    const prompt = generateNextPrompt(makeInput({
      decision: 'BLOCKED',
      riskFlags: [flag('destructive-command')],
    }));
    assert.ok(prompt.startsWith('STOP'), 'destructive-command BLOCKED prompt must start with STOP');
  });

  test('BLOCKED with destructive-command asks about which commands ran', () => {
    const prompt = generateNextPrompt(makeInput({
      decision: 'BLOCKED',
      riskFlags: [flag('destructive-command')],
    }));
    assert.ok(prompt.toLowerCase().includes('command'), 'must ask about commands');
  });
});

describe('generateNextPrompt — BLOCKED (secrets-exposure)', () => {
  test('BLOCKED with secrets-exposure mentions rotating credentials', () => {
    const prompt = generateNextPrompt(makeInput({
      decision: 'BLOCKED',
      riskFlags: [flag('secrets-exposure')],
    }));
    assert.ok(
      prompt.toLowerCase().includes('secret') || prompt.toLowerCase().includes('credential') || prompt.toLowerCase().includes('rotat'),
      'secrets BLOCKED prompt must mention secrets/credentials/rotating',
    );
  });
});

describe('generateNextPrompt — SENIOR_APPROVAL_REQUIRED', () => {
  test('starts with PAUSE', () => {
    const prompt = generateNextPrompt(makeInput({
      decision: 'SENIOR_APPROVAL_REQUIRED',
      riskFlags: [flag('auth-security-change')],
    }));
    assert.ok(prompt.startsWith('PAUSE'), 'SENIOR_APPROVAL_REQUIRED prompt must start with PAUSE');
  });

  test('includes the task title', () => {
    const prompt = generateNextPrompt(makeInput({
      decision: 'SENIOR_APPROVAL_REQUIRED',
      taskTitle: 'Update CORS config',
      riskFlags: [flag('auth-security-change')],
    }));
    assert.ok(prompt.includes('Update CORS config'), 'must include task title');
  });

  test('asks for list of changes made', () => {
    const prompt = generateNextPrompt(makeInput({
      decision: 'SENIOR_APPROVAL_REQUIRED',
      riskFlags: [flag('auth-security-change')],
    }));
    assert.ok(prompt.toLowerCase().includes('change') || prompt.toLowerCase().includes('modif'),
      'must ask for list of changes');
  });
});

describe('generateNextPrompt — ASK_AGENT_FOR_EVIDENCE', () => {
  test('includes task title in preamble', () => {
    const prompt = generateNextPrompt(makeInput({
      decision: 'ASK_AGENT_FOR_EVIDENCE',
      taskTitle: 'Add new API endpoint',
      missingEvidence: [missing('files-changed')],
    }));
    assert.ok(prompt.includes('Add new API endpoint'), 'must include task title');
  });

  test('mentions files when files-changed is missing', () => {
    const prompt = generateNextPrompt(makeInput({
      decision: 'ASK_AGENT_FOR_EVIDENCE',
      missingEvidence: [missing('files-changed')],
    }));
    assert.ok(prompt.toLowerCase().includes('file'), 'must ask about files when files-changed missing');
  });

  test('mentions commands when commands-run is missing', () => {
    const prompt = generateNextPrompt(makeInput({
      decision: 'ASK_AGENT_FOR_EVIDENCE',
      missingEvidence: [missing('commands-run')],
    }));
    assert.ok(prompt.toLowerCase().includes('command'), 'must ask about commands when commands-run missing');
  });
});

describe('generateNextPrompt — RUN_VALIDATION', () => {
  test('lists npm run build as a validation command', () => {
    const prompt = generateNextPrompt(makeInput({
      decision: 'RUN_VALIDATION',
      filesMentioned: ['src/app/page.tsx'],
    }));
    assert.ok(prompt.includes('npm run build'), 'RUN_VALIDATION prompt must list npm run build');
  });

  test('includes files context when files are provided', () => {
    const prompt = generateNextPrompt(makeInput({
      decision: 'RUN_VALIDATION',
      filesMentioned: ['src/lib/utils.ts', 'src/app/page.tsx'],
    }));
    assert.ok(prompt.includes('src/lib/utils.ts'), 'must mention changed files');
  });

  test('instructs to fix only the reported error', () => {
    const prompt = generateNextPrompt(makeInput({ decision: 'RUN_VALIDATION' }));
    assert.ok(
      prompt.toLowerCase().includes('fix only') || prompt.toLowerCase().includes('reported error'),
      'must instruct to fix only reported errors',
    );
  });
});
