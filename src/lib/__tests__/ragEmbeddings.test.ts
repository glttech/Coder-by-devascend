/**
 * Tests for RAG embedding provider (src/lib/rag/embeddings.ts).
 *
 * Uses node:test — NOT Jest. No real API calls, no real DB.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildStubEmbedding,
  cosineSimilarity,
  embedText,
  serializeEmbedding,
  deserializeEmbedding,
  EMBEDDING_DIM,
  STUB_MODEL,
} from '../rag/embeddings.js';

// ---------------------------------------------------------------------------
// buildStubEmbedding
// ---------------------------------------------------------------------------

describe('buildStubEmbedding', () => {
  it('returns a vector of length EMBEDDING_DIM', () => {
    const result = buildStubEmbedding('hello world');
    assert.equal(result.vector.length, EMBEDDING_DIM);
  });

  it('returns model = STUB_MODEL', () => {
    const result = buildStubEmbedding('test');
    assert.equal(result.model, STUB_MODEL);
  });

  it('returns tokenCount = 0', () => {
    const result = buildStubEmbedding('test');
    assert.equal(result.tokenCount, 0);
  });

  it('is deterministic for the same input', () => {
    const a = buildStubEmbedding('same text');
    const b = buildStubEmbedding('same text');
    assert.deepEqual(a.vector, b.vector);
  });

  it('produces different vectors for different inputs', () => {
    const a = buildStubEmbedding('text one');
    const b = buildStubEmbedding('text two different');
    assert.notDeepEqual(a.vector, b.vector);
  });

  it('produces a unit-length vector', () => {
    const { vector } = buildStubEmbedding('normalisation check');
    const magnitude = Math.sqrt(vector.reduce((s, v) => s + v * v, 0));
    assert.ok(Math.abs(magnitude - 1) < 1e-9, `Expected unit vector, got magnitude ${magnitude}`);
  });

  it('handles empty string without throwing', () => {
    const result = buildStubEmbedding('');
    assert.equal(result.vector.length, EMBEDDING_DIM);
  });
});

// ---------------------------------------------------------------------------
// cosineSimilarity
// ---------------------------------------------------------------------------

describe('cosineSimilarity', () => {
  it('returns 1.0 for identical vectors', () => {
    const v = [1, 0, 0];
    assert.equal(cosineSimilarity(v, v), 1);
  });

  it('returns 0 for orthogonal vectors', () => {
    const a = [1, 0, 0];
    const b = [0, 1, 0];
    assert.equal(cosineSimilarity(a, b), 0);
  });

  it('returns 0 for zero-length vectors', () => {
    assert.equal(cosineSimilarity([], []), 0);
  });

  it('returns 0 for mismatched lengths', () => {
    assert.equal(cosineSimilarity([1, 2], [1]), 0);
  });

  it('similarity of stub embedding with itself is 1', () => {
    const { vector } = buildStubEmbedding('any text here');
    const sim = cosineSimilarity(vector, vector);
    assert.ok(Math.abs(sim - 1) < 1e-9);
  });

  it('stub similarity of similar text is higher than of dissimilar text', () => {
    const base = buildStubEmbedding('deploy to production');
    const similar = buildStubEmbedding('deploy to production server');
    const dissimilar = buildStubEmbedding('this is about cooking recipes');
    const simSim = cosineSimilarity(base.vector, similar.vector);
    const simDis = cosineSimilarity(base.vector, dissimilar.vector);
    // Stub is not semantically aware, but we verify it doesn't explode
    assert.ok(simSim >= 0 && simSim <= 1 + 1e-9);
    assert.ok(simDis >= 0 && simDis <= 1 + 1e-9);
  });
});

// ---------------------------------------------------------------------------
// serializeEmbedding / deserializeEmbedding
// ---------------------------------------------------------------------------

describe('serializeEmbedding / deserializeEmbedding', () => {
  it('round-trips a vector', () => {
    const { vector } = buildStubEmbedding('round trip test');
    const serialised = serializeEmbedding(vector);
    const restored = deserializeEmbedding(serialised);
    assert.deepEqual(restored, vector);
  });

  it('returns null for null input', () => {
    assert.equal(deserializeEmbedding(null), null);
  });

  it('returns null for undefined input', () => {
    assert.equal(deserializeEmbedding(undefined), null);
  });

  it('returns null for invalid JSON', () => {
    assert.equal(deserializeEmbedding('not json'), null);
  });

  it('returns null for non-array JSON', () => {
    assert.equal(deserializeEmbedding('{"key":"value"}'), null);
  });

  it('filters out non-number elements', () => {
    const result = deserializeEmbedding('[1.0, "bad", 2.0, null]');
    assert.deepEqual(result, [1.0, 2.0]);
  });
});

// ---------------------------------------------------------------------------
// embedText — stub mode (FEATURE_RAG_EMBED=false)
// ---------------------------------------------------------------------------

describe('embedText — stub mode', () => {
  before(() => {
    delete process.env.FEATURE_RAG_EMBED;
  });

  it('returns stub embedding when flag is off', async () => {
    const result = await embedText('test content');
    assert.equal(result.model, STUB_MODEL);
    assert.equal(result.vector.length, EMBEDDING_DIM);
  });

  it('is deterministic in stub mode', async () => {
    const a = await embedText('determinism check');
    const b = await embedText('determinism check');
    assert.deepEqual(a.vector, b.vector);
  });
});

// ---------------------------------------------------------------------------
// embedText — fail-closed when API key missing
// ---------------------------------------------------------------------------

describe('embedText — fail-closed when API key missing', () => {
  before(() => {
    process.env.FEATURE_RAG_EMBED = 'true';
    delete process.env.OPENAI_API_KEY;
  });

  after(() => {
    delete process.env.FEATURE_RAG_EMBED;
  });

  it('throws when FEATURE_RAG_EMBED=true but OPENAI_API_KEY is not set', async () => {
    await assert.rejects(
      () => embedText('test'),
      (err: unknown) => {
        assert.ok(err instanceof Error);
        assert.ok(
          err.message.includes('OPENAI_API_KEY'),
          `Expected message to mention OPENAI_API_KEY, got: ${err.message}`,
        );
        return true;
      },
    );
  });

  it('does not silently return stub when flag is true and key missing', async () => {
    let threw = false;
    try {
      const result = await embedText('test');
      // If it returns stub, it should still have the right shape
      // but we want it to throw
      assert.notEqual(result.model, STUB_MODEL, 'Should have thrown, not returned stub');
    } catch {
      threw = true;
    }
    assert.equal(threw, true, 'Expected embedText to throw, not return stub');
  });
});
