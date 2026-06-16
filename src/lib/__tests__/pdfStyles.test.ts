import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { PDF_PRINT_CSS } from '../pdfStyles';

describe('PDF_PRINT_CSS', () => {
  test('contains @page rule', () => {
    assert.ok(PDF_PRINT_CSS.includes('@page'));
  });
  test('contains body rule', () => {
    assert.ok(PDF_PRINT_CSS.includes('body'));
  });
  test('contains print media query', () => {
    assert.ok(PDF_PRINT_CSS.includes('@media'));
  });
  test('non-empty string', () => {
    assert.ok(PDF_PRINT_CSS.length > 100);
  });
});
