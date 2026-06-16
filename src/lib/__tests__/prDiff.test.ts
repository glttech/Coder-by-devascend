import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { generatePrDiffDiagram } from '../diagrams/prDiff';

describe('generatePrDiffDiagram', () => {
  test('empty files returns no-changes diagram', () => {
    const d = generatePrDiffDiagram(42, []);
    assert.ok(d.source.includes('No file changes'));
    assert.ok(d.title.includes('42'));
  });

  test('single file generates graph', () => {
    const d = generatePrDiffDiagram(1, ['src/index.ts']);
    assert.ok(d.source.startsWith('graph LR'));
  });

  test('nested files are grouped by directory', () => {
    const d = generatePrDiffDiagram(5, ['src/lib/foo.ts', 'src/lib/bar.ts', 'package.json']);
    assert.ok(d.source.includes('src'));
  });

  test('caps at 50 files', () => {
    const files = Array.from({ length: 100 }, (_, i) => `src/file${i}.ts`);
    const d = generatePrDiffDiagram(3, files);
    assert.ok(d.title.includes('showing 50'));
  });

  test('title includes PR number and file count', () => {
    const d = generatePrDiffDiagram(99, ['a.ts', 'b.ts']);
    assert.ok(d.title.includes('99'));
    assert.ok(d.title.includes('2 files'));
  });
});
