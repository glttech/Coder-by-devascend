import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// Inline the validation logic to test it without HTTP overhead.
// These mirror the exact conditions added to the API routes.

const MAX_TITLE = 500;
const MAX_BODY = 50_000;
const MAX_AGENT_RESPONSE = 50_000;

function validateTitle(title: unknown): string | null {
  if (!title || typeof title !== 'string' || title.trim().length === 0) return 'title is required';
  if (title.length > MAX_TITLE) return 'title must be 500 characters or fewer';
  return null;
}

function validateBody(body: unknown): string | null {
  if (!body || typeof body !== 'string' || (body as string).trim().length === 0) return 'body is required';
  if ((body as string).length > MAX_BODY) return 'body must be 50,000 characters or fewer';
  return null;
}

function validateAgentResponse(response: unknown): string | null {
  if (response && typeof response === 'string' && response.length > MAX_AGENT_RESPONSE) {
    return 'agentResponse must be 50,000 characters or fewer';
  }
  return null;
}

describe('title validation', () => {
  test('accepts valid title', () => assert.equal(validateTitle('Fix the auth bug'), null));
  test('rejects empty title', () => assert.ok(validateTitle('') !== null));
  test('rejects whitespace-only title', () => assert.ok(validateTitle('   ') !== null));
  test('rejects missing title', () => assert.ok(validateTitle(undefined) !== null));
  test('accepts title at max length', () => assert.equal(validateTitle('a'.repeat(MAX_TITLE)), null));
  test('rejects title over max length', () => assert.ok(validateTitle('a'.repeat(MAX_TITLE + 1)) !== null));
});

describe('body/instruction validation', () => {
  test('accepts valid body', () => assert.equal(validateBody('Do the thing carefully.'), null));
  test('rejects empty body', () => assert.ok(validateBody('') !== null));
  test('accepts body at max length', () => assert.equal(validateBody('a'.repeat(MAX_BODY)), null));
  test('rejects body over max length', () => assert.ok(validateBody('a'.repeat(MAX_BODY + 1)) !== null));
});

describe('agentResponse length guard', () => {
  test('accepts null agentResponse', () => assert.equal(validateAgentResponse(null), null));
  test('accepts undefined agentResponse', () => assert.equal(validateAgentResponse(undefined), null));
  test('accepts normal agentResponse', () => assert.equal(validateAgentResponse('Build passed.'), null));
  test('accepts agentResponse at max length', () => assert.equal(validateAgentResponse('a'.repeat(MAX_AGENT_RESPONSE)), null));
  test('rejects agentResponse over max length', () => assert.ok(validateAgentResponse('a'.repeat(MAX_AGENT_RESPONSE + 1)) !== null));
});
