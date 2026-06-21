import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { validateSessionIntelligencePatch } from '../coder/sessionIntelligenceParams.js';

// ---------------------------------------------------------------------------
// validateSessionIntelligencePatch — happy paths
// ---------------------------------------------------------------------------

describe('validateSessionIntelligencePatch — summary', () => {
  test('accepts a valid summary', () => {
    const result = validateSessionIntelligencePatch({ summary: 'Did some work' });
    assert.equal(result.summary, 'Did some work');
  });

  test('trims whitespace from summary', () => {
    const result = validateSessionIntelligencePatch({ summary: '  trimmed  ' });
    assert.equal(result.summary, 'trimmed');
  });

  test('accepts null summary (clears it)', () => {
    const result = validateSessionIntelligencePatch({ summary: null, filesChanged: [] });
    assert.equal(result.summary, undefined);
  });

  test('accepts max-length summary', () => {
    const long = 'x'.repeat(2000);
    const result = validateSessionIntelligencePatch({ summary: long });
    assert.equal(result.summary, long);
  });

  test('rejects summary over 2000 chars', () => {
    assert.throws(
      () => validateSessionIntelligencePatch({ summary: 'x'.repeat(2001) }),
      /exceeds 2000/,
    );
  });

  test('treats empty-after-trim summary as absent (undefined)', () => {
    const result = validateSessionIntelligencePatch({ summary: '   ', filesChanged: [] });
    assert.equal(result.summary, undefined);
  });
});

describe('validateSessionIntelligencePatch — failureReason', () => {
  test('accepts a valid failureReason', () => {
    const result = validateSessionIntelligencePatch({ failureReason: 'Timeout exceeded' });
    assert.equal(result.failureReason, 'Timeout exceeded');
  });

  test('trims whitespace from failureReason', () => {
    const result = validateSessionIntelligencePatch({ failureReason: '  trimmed  ' });
    assert.equal(result.failureReason, 'trimmed');
  });

  test('accepts null failureReason', () => {
    const result = validateSessionIntelligencePatch({ failureReason: null, filesChanged: [] });
    assert.equal(result.failureReason, undefined);
  });

  test('rejects failureReason over 2000 chars', () => {
    assert.throws(
      () => validateSessionIntelligencePatch({ failureReason: 'x'.repeat(2001) }),
      /exceeds 2000/,
    );
  });

  test('rejects non-string failureReason', () => {
    assert.throws(
      () => validateSessionIntelligencePatch({ failureReason: 42 }),
      /string or null/,
    );
  });
});

describe('validateSessionIntelligencePatch — filesChanged', () => {
  test('accepts an empty array', () => {
    const result = validateSessionIntelligencePatch({ filesChanged: [] });
    assert.deepEqual(result.filesChanged, []);
  });

  test('accepts a list of file paths', () => {
    const files = ['src/app/page.tsx', 'prisma/schema.prisma'];
    const result = validateSessionIntelligencePatch({ filesChanged: files });
    assert.deepEqual(result.filesChanged, files);
  });

  test('accepts exactly 500 entries', () => {
    const files = Array.from({ length: 500 }, (_, i) => `file${i}.ts`);
    const result = validateSessionIntelligencePatch({ filesChanged: files });
    assert.equal(result.filesChanged!.length, 500);
  });

  test('rejects more than 500 entries', () => {
    const files = Array.from({ length: 501 }, (_, i) => `file${i}.ts`);
    assert.throws(
      () => validateSessionIntelligencePatch({ filesChanged: files }),
      /exceeds 500/,
    );
  });

  test('rejects non-array filesChanged', () => {
    assert.throws(
      () => validateSessionIntelligencePatch({ filesChanged: 'not-an-array' }),
      /must be an array/,
    );
  });

  test('rejects non-string file entries', () => {
    assert.throws(
      () => validateSessionIntelligencePatch({ filesChanged: [123] }),
      /must be a string/,
    );
  });

  test('rejects file path over 500 chars', () => {
    assert.throws(
      () => validateSessionIntelligencePatch({ filesChanged: ['x'.repeat(501)] }),
      /file path exceeds/,
    );
  });
});

// ---------------------------------------------------------------------------
// validateSessionIntelligencePatch — multi-field combos
// ---------------------------------------------------------------------------

describe('validateSessionIntelligencePatch — multi-field', () => {
  test('accepts all three fields together', () => {
    const result = validateSessionIntelligencePatch({
      summary: 'Session done',
      failureReason: null,
      filesChanged: ['a.ts', 'b.ts'],
    });
    assert.equal(result.summary, 'Session done');
    assert.equal(result.failureReason, undefined);
    assert.deepEqual(result.filesChanged, ['a.ts', 'b.ts']);
  });

  test('accepts summary + filesChanged without failureReason', () => {
    const result = validateSessionIntelligencePatch({
      summary: 'Done',
      filesChanged: ['x.ts'],
    });
    assert.equal(result.summary, 'Done');
    assert.deepEqual(result.filesChanged, ['x.ts']);
    assert.equal(result.failureReason, undefined);
  });

  test('accepts failureReason alone (single field)', () => {
    const result = validateSessionIntelligencePatch({ failureReason: 'exit 1' });
    assert.equal(result.failureReason, 'exit 1');
  });
});

// ---------------------------------------------------------------------------
// validateSessionIntelligencePatch — structural errors
// ---------------------------------------------------------------------------

describe('validateSessionIntelligencePatch — structural errors', () => {
  test('rejects null body', () => {
    assert.throws(() => validateSessionIntelligencePatch(null), /JSON object/);
  });

  test('rejects array body', () => {
    assert.throws(() => validateSessionIntelligencePatch([]), /JSON object/);
  });

  test('rejects string body', () => {
    assert.throws(() => validateSessionIntelligencePatch('hello'), /JSON object/);
  });

  test('rejects empty object (no valid fields)', () => {
    assert.throws(() => validateSessionIntelligencePatch({}), /No valid fields/);
  });

  test('rejects object with only unknown fields', () => {
    assert.throws(() => validateSessionIntelligencePatch({ unknown: 'field' }), /No valid fields/);
  });

  test('rejects non-string summary', () => {
    assert.throws(
      () => validateSessionIntelligencePatch({ summary: 123 }),
      /string or null/,
    );
  });
});
