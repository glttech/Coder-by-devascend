import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  detectIntent,
  buildExcerpt,
  isLlmSummaryEnabled,
} from '../memorySearch.js';

// ── detectIntent ───────────────────────────────────────────────────────────────

describe('detectIntent', () => {
  test('"what did we build last week" → recent_features', () => {
    assert.equal(detectIntent('what did we build last week'), 'recent_features');
  });

  test('"features added this sprint" → recent_features', () => {
    assert.equal(detectIntent('features added this sprint'), 'recent_features');
  });

  test('"which PR changed auth" → auth_changes', () => {
    assert.equal(detectIntent('which PR changed auth'), 'auth_changes');
  });

  test('"login session token" → auth_changes', () => {
    assert.equal(detectIntent('login session token'), 'auth_changes');
  });

  test('"what migrations were added" → migrations', () => {
    assert.equal(detectIntent('what migrations were added'), 'migrations');
  });

  test('"schema change for users" → migrations', () => {
    assert.equal(detectIntent('schema change for users'), 'migrations');
  });

  test('"what bugs exist" → bugs', () => {
    assert.equal(detectIntent('what bugs exist'), 'bugs');
  });

  test('"regression in login flow" → bugs', () => {
    assert.equal(detectIntent('regression in login flow'), 'bugs');
  });

  test('"what is pending before production" → pending', () => {
    assert.equal(detectIntent('what is pending before production'), 'pending');
  });

  test('"unresolved issues" → pending', () => {
    assert.equal(detectIntent('unresolved issues'), 'pending');
  });

  test('"security vulnerability in session" → security', () => {
    assert.equal(detectIntent('security vulnerability in session'), 'security');
  });

  test('"CVE patch" → security', () => {
    assert.equal(detectIntent('CVE patch applied'), 'security');
  });

  test('"deploy to staging" → deployments', () => {
    assert.equal(detectIntent('deploy to staging'), 'deployments');
  });

  test('"release v2.3" → deployments', () => {
    assert.equal(detectIntent('release v2.3'), 'deployments');
  });

  test('unrecognised query → general', () => {
    assert.equal(detectIntent('something completely random xyz'), 'general');
  });

  test('empty string → general', () => {
    assert.equal(detectIntent(''), 'general');
  });
});

// ── buildExcerpt ───────────────────────────────────────────────────────────────

describe('buildExcerpt', () => {
  test('returns empty string for null input', () => {
    assert.equal(buildExcerpt(null, 'auth'), '');
  });

  test('returns empty string for undefined input', () => {
    assert.equal(buildExcerpt(undefined, 'auth'), '');
  });

  test('returns truncated text when query not found', () => {
    const text = 'A'.repeat(200);
    const excerpt = buildExcerpt(text, 'xyz');
    assert.ok(excerpt.endsWith('…'));
    assert.ok(excerpt.length <= 125);
  });

  test('centres excerpt around query term', () => {
    const text = 'Introduction ' + 'filler '.repeat(20) + 'authentication system details here';
    const excerpt = buildExcerpt(text, 'authentication');
    assert.ok(excerpt.includes('authentication'));
  });

  test('short text with match returns without ellipsis at end', () => {
    const text = 'This PR fixes auth';
    const excerpt = buildExcerpt(text, 'auth');
    assert.ok(!excerpt.endsWith('…'));
  });

  test('handles multi-word query by using first significant term', () => {
    const text = 'The authentication middleware was updated.';
    const excerpt = buildExcerpt(text, 'authentication changes');
    assert.ok(excerpt.includes('authentication'));
  });
});

// ── isLlmSummaryEnabled ────────────────────────────────────────────────────────

describe('isLlmSummaryEnabled', () => {
  test('returns false when flag is not set', () => {
    const original = process.env.FEATURE_REPO_MEMORY_LLM;
    delete process.env.FEATURE_REPO_MEMORY_LLM;
    assert.equal(isLlmSummaryEnabled(), false);
    if (original !== undefined) process.env.FEATURE_REPO_MEMORY_LLM = original;
  });

  test('returns false when flag is "false"', () => {
    process.env.FEATURE_REPO_MEMORY_LLM = 'false';
    assert.equal(isLlmSummaryEnabled(), false);
    delete process.env.FEATURE_REPO_MEMORY_LLM;
  });

  test('returns true when flag is "true"', () => {
    process.env.FEATURE_REPO_MEMORY_LLM = 'true';
    assert.equal(isLlmSummaryEnabled(), true);
    delete process.env.FEATURE_REPO_MEMORY_LLM;
  });

  test('returns false for any value other than "true"', () => {
    for (const val of ['1', 'yes', 'TRUE', 'True']) {
      process.env.FEATURE_REPO_MEMORY_LLM = val;
      assert.equal(isLlmSummaryEnabled(), false, `expected false for "${val}"`);
    }
    delete process.env.FEATURE_REPO_MEMORY_LLM;
  });
});
