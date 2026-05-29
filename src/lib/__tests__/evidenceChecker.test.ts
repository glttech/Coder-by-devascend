import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { checkMissingEvidence, type EvidenceInput } from '../evidenceChecker.js';

function makeInput(overrides: Partial<EvidenceInput> = {}): EvidenceInput {
  return {
    agentResponse: 'The task has been completed successfully.',
    filesMentioned: ['src/app/page.tsx'],
    commandsMentioned: ['npm run build'],
    validationOutput: 'Build successful. No errors.',
    reviewerNotes: 'Looks good, safe to proceed.',
    ...overrides,
  };
}

describe('checkMissingEvidence — complete input', () => {
  test('fully populated input returns no missing evidence', () => {
    const missing = checkMissingEvidence(makeInput());
    assert.equal(missing.length, 0, 'complete input should have no missing evidence');
  });
});

describe('checkMissingEvidence — agent response', () => {
  test('null agentResponse flags agent-response as missing', () => {
    const missing = checkMissingEvidence(makeInput({ agentResponse: null }));
    const keys = missing.map((m) => m.key);
    assert.ok(keys.includes('agent-response'), 'null agentResponse must flag agent-response');
  });

  test('empty string agentResponse flags agent-response as missing', () => {
    const missing = checkMissingEvidence(makeInput({ agentResponse: '' }));
    const keys = missing.map((m) => m.key);
    assert.ok(keys.includes('agent-response'), 'empty agentResponse must flag agent-response');
  });

  test('very short agentResponse (< 10 chars) flags agent-response as missing', () => {
    const missing = checkMissingEvidence(makeInput({ agentResponse: 'ok' }));
    const keys = missing.map((m) => m.key);
    assert.ok(keys.includes('agent-response'), 'too-short agentResponse must flag agent-response');
  });

  test('adequate agentResponse does not flag agent-response', () => {
    const missing = checkMissingEvidence(makeInput({ agentResponse: 'The build passed and the task is complete.' }));
    const keys = missing.map((m) => m.key);
    assert.ok(!keys.includes('agent-response'), 'adequate agentResponse must not flag agent-response');
  });
});

describe('checkMissingEvidence — files and commands', () => {
  test('empty filesMentioned flags files-changed', () => {
    const missing = checkMissingEvidence(makeInput({ filesMentioned: [] }));
    const keys = missing.map((m) => m.key);
    assert.ok(keys.includes('files-changed'), 'empty filesMentioned must flag files-changed');
  });

  test('empty commandsMentioned flags commands-run', () => {
    const missing = checkMissingEvidence(makeInput({ commandsMentioned: [] }));
    const keys = missing.map((m) => m.key);
    assert.ok(keys.includes('commands-run'), 'empty commandsMentioned must flag commands-run');
  });

  test('non-empty filesMentioned does not flag files-changed', () => {
    const missing = checkMissingEvidence(makeInput({ filesMentioned: ['src/index.ts'] }));
    const keys = missing.map((m) => m.key);
    assert.ok(!keys.includes('files-changed'), 'non-empty filesMentioned must not flag files-changed');
  });
});

describe('checkMissingEvidence — validation output', () => {
  test('null validationOutput flags validation-output', () => {
    const missing = checkMissingEvidence(makeInput({ validationOutput: null }));
    const keys = missing.map((m) => m.key);
    assert.ok(keys.includes('validation-output'), 'null validationOutput must flag validation-output');
  });

  test('whitespace-only validationOutput flags validation-output', () => {
    const missing = checkMissingEvidence(makeInput({ validationOutput: '   ' }));
    const keys = missing.map((m) => m.key);
    assert.ok(keys.includes('validation-output'), 'whitespace validationOutput must flag validation-output');
  });
});

describe('checkMissingEvidence — reviewer notes', () => {
  test('missing reviewerNotes flags reviewer-notes', () => {
    const missing = checkMissingEvidence(makeInput({ reviewerNotes: null }));
    const keys = missing.map((m) => m.key);
    assert.ok(keys.includes('reviewer-notes'), 'null reviewerNotes must flag reviewer-notes');
  });
});

describe('checkMissingEvidence — missing evidence has required shape', () => {
  test('each missing entry has key, label, and description', () => {
    const missing = checkMissingEvidence(makeInput({ agentResponse: null, filesMentioned: [] }));
    for (const m of missing) {
      assert.ok(typeof m.key === 'string' && m.key.length > 0, 'missing entry must have a key');
      assert.ok(typeof m.label === 'string' && m.label.length > 0, 'missing entry must have a label');
      assert.ok(typeof m.description === 'string' && m.description.length > 0, 'missing entry must have a description');
    }
  });
});
