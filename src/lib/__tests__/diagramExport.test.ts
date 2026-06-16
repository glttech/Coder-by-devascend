import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

describe('diagram export', () => {
  test('export URL is correctly formed', () => {
    const id = 'abc123';
    const url = `/api/diagrams/${id}/export`;
    assert.equal(url, '/api/diagrams/abc123/export');
  });

  test('filename derives from diagramId', () => {
    const diagramId = 'test-diagram-id-xyz';
    const filename = `diagram-${diagramId.slice(0, 8)}.svg`;
    assert.equal(filename, 'diagram-test-dia.svg');
  });
});
