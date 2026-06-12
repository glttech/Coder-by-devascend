import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { evaluatePrompt, type PromptEvalInput } from '../promptEval.js';

function makeInput(overrides: Partial<PromptEvalInput> = {}): PromptEvalInput {
  return {
    prompt: 'This is a sufficiently long prompt that references the Fix Login Bug task and has real content.',
    taskTitle: 'Fix Login Bug',
    riskLevel: 'low',
    ...overrides,
  };
}

describe('evaluatePrompt — short prompt fails', () => {
  it('prompt under 50 chars fails and includes reason', () => {
    const result = evaluatePrompt(makeInput({ prompt: 'Too short' }));
    assert.equal(result.passed, false);
    assert.ok(result.reasons.includes('Prompt too short'), 'should include short-prompt reason');
    assert.ok(result.score < 1.0);
  });
});

describe('evaluatePrompt — long enough prompt passes', () => {
  it('prompt >= 50 chars with task title and no placeholders passes', () => {
    const prompt = 'Fix Login Bug: investigate authentication failures in the login flow and resolve the root cause.';
    const result = evaluatePrompt(makeInput({ prompt }));
    assert.equal(result.passed, true);
    assert.equal(result.reasons.length, 0);
  });
});

describe('evaluatePrompt — high-risk needs 200 chars', () => {
  it('high-risk prompt under 200 chars fails with specific reason', () => {
    // Prompt is long enough for low-risk (>= 50) but fails the high-risk 200-char check.
    // Also omit the task title so only 2 of 4 checks pass → score 0.5 → failed.
    const prompt = 'This prompt is over 50 chars but under 200 chars and does not mention the task title at all.';
    assert.ok(prompt.length >= 50 && prompt.length < 200);
    const result = evaluatePrompt(makeInput({ prompt, riskLevel: 'high', taskTitle: 'Fix Login Bug' }));
    assert.equal(result.passed, false);
    assert.ok(
      result.reasons.includes('High-risk prompt must be >= 200 chars'),
      'should include high-risk length reason',
    );
  });

  it('high-risk prompt >= 200 chars does not fail on length check', () => {
    const prompt =
      'Fix Login Bug: ' +
      'This is a detailed high-risk prompt that explains the task thoroughly. ' +
      'We need to investigate the authentication system and resolve the root cause. ' +
      'All changes must be reviewed carefully before deployment.';
    assert.ok(prompt.length >= 200);
    const result = evaluatePrompt(makeInput({ prompt, riskLevel: 'high' }));
    assert.ok(
      !result.reasons.includes('High-risk prompt must be >= 200 chars'),
      'should not fail on high-risk length when >= 200 chars',
    );
  });
});

describe('evaluatePrompt — placeholder text fails', () => {
  it('prompt with TODO fails', () => {
    const prompt =
      'Fix Login Bug: investigate the auth system. TODO: add more details here with sufficient length.';
    const result = evaluatePrompt(makeInput({ prompt }));
    assert.equal(result.passed, false);
    assert.ok(result.reasons.includes('Prompt contains placeholder text'));
  });

  it('prompt with FIXME fails', () => {
    const prompt =
      'Fix Login Bug: investigate the auth system. FIXME: complete this prompt with more details later.';
    const result = evaluatePrompt(makeInput({ prompt }));
    assert.equal(result.passed, false);
    assert.ok(result.reasons.includes('Prompt contains placeholder text'));
  });

  it('prompt with PLACEHOLDER fails', () => {
    const prompt =
      'Fix Login Bug: PLACEHOLDER text that should be replaced before dispatch for the actual task.';
    const result = evaluatePrompt(makeInput({ prompt }));
    assert.equal(result.passed, false);
    assert.ok(result.reasons.includes('Prompt contains placeholder text'));
  });
});

describe('evaluatePrompt — missing task title reduces score', () => {
  it('prompt without task title includes title reason and has lower score', () => {
    const prompt =
      'Investigate authentication failures in the login flow and resolve the root cause of the issue.';
    const result = evaluatePrompt(makeInput({ prompt, taskTitle: 'Fix Login Bug' }));
    assert.ok(result.reasons.includes('Prompt should reference the task title'));
    // 2 of 3 checks pass → score ≈ 0.667 → passed should be false
    assert.equal(result.passed, false);
  });
});

describe('evaluatePrompt — perfect prompt passes with score 1.0', () => {
  it('perfect low-risk prompt scores 1.0', () => {
    const prompt =
      'Fix Login Bug: investigate authentication failures in the login flow and resolve the root cause.';
    const result = evaluatePrompt(makeInput({ prompt, taskTitle: 'Fix Login Bug', riskLevel: 'low' }));
    assert.equal(result.passed, true);
    assert.equal(result.score, 1.0);
    assert.equal(result.reasons.length, 0);
  });

  it('perfect high-risk prompt scores 1.0', () => {
    const prompt =
      'Fix Login Bug: ' +
      'This is a detailed high-risk prompt that explains the task thoroughly. ' +
      'We need to investigate the authentication system and resolve the root cause. ' +
      'All changes must be reviewed carefully before deployment to production.';
    assert.ok(prompt.length >= 200);
    const result = evaluatePrompt(makeInput({ prompt, taskTitle: 'Fix Login Bug', riskLevel: 'high' }));
    assert.equal(result.passed, true);
    assert.equal(result.score, 1.0);
    assert.equal(result.reasons.length, 0);
  });
});
