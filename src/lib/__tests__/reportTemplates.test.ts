import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  htmlWrapper,
  htmlBadge,
  htmlSection,
  htmlTable,
  escapeHtml,
} from '../reportTemplates.js';

// ── htmlBadge ──────────────────────────────────────────────────────────────

describe('htmlBadge', () => {
  test('returns a string containing the text', () => {
    const result = htmlBadge('Approved', 'green');
    assert.ok(result.includes('Approved'), 'badge should contain the text');
  });

  test('contains the badge class', () => {
    const result = htmlBadge('Pending', 'gray');
    assert.ok(result.includes('class="badge"'), 'badge should have badge class');
  });

  test('applies preset green colours', () => {
    const result = htmlBadge('OK', 'green');
    assert.ok(result.includes('#dcfce7'), 'green preset should have light green bg');
    assert.ok(result.includes('#166534'), 'green preset should have dark green fg');
  });

  test('applies preset red colours', () => {
    const result = htmlBadge('Failed', 'red');
    assert.ok(result.includes('#fee2e2'), 'red preset should have light red bg');
  });

  test('applies custom CSS colour when not a preset', () => {
    const result = htmlBadge('Custom', '#3b82f6');
    assert.ok(result.includes('background:#3b82f6'), 'custom colour should appear in style');
  });

  test('escapes HTML in text', () => {
    const result = htmlBadge('<script>', 'gray');
    assert.ok(!result.includes('<script>'), 'should escape script tags');
    assert.ok(result.includes('&lt;script&gt;'), 'should contain escaped version');
  });
});

// ── htmlTable ──────────────────────────────────────────────────────────────

describe('htmlTable', () => {
  test('returns a string with thead', () => {
    const result = htmlTable(['Col A', 'Col B'], [['val1', 'val2']]);
    assert.ok(result.includes('<thead>'), 'should contain thead');
  });

  test('returns a string with tbody', () => {
    const result = htmlTable(['Col A', 'Col B'], [['val1', 'val2']]);
    assert.ok(result.includes('<tbody>'), 'should contain tbody');
  });

  test('contains header text', () => {
    const result = htmlTable(['Name', 'Status'], []);
    assert.ok(result.includes('Name'), 'thead should contain header text');
    assert.ok(result.includes('Status'), 'thead should contain header text');
  });

  test('contains cell values', () => {
    const result = htmlTable(['Title'], [['My Task'], ['Another Task']]);
    assert.ok(result.includes('My Task'), 'should contain row cell value');
    assert.ok(result.includes('Another Task'), 'should contain second row value');
  });

  test('handles empty rows array', () => {
    const result = htmlTable(['Header'], []);
    assert.ok(result.includes('<thead>'), 'empty rows table still has thead');
    assert.ok(result.includes('<tbody>'), 'empty rows table still has tbody');
  });

  test('wraps in <table> tag', () => {
    const result = htmlTable(['H'], [['v']]);
    assert.ok(result.startsWith('<table>'), 'should start with <table>');
    assert.ok(result.includes('</table>'), 'should end with </table>');
  });
});

// ── htmlWrapper ────────────────────────────────────────────────────────────

describe('htmlWrapper', () => {
  test('returns a string starting with <!DOCTYPE html>', () => {
    const result = htmlWrapper('Test', '<p>body</p>');
    assert.ok(result.startsWith('<!DOCTYPE html>'), 'should start with DOCTYPE');
  });

  test('contains the title in <title>', () => {
    const result = htmlWrapper('My Report', '<p>body</p>');
    assert.ok(result.includes('<title>My Report</title>'), 'should include title in <title>');
  });

  test('includes the body content', () => {
    const result = htmlWrapper('T', '<p>hello world</p>');
    assert.ok(result.includes('<p>hello world</p>'), 'body content should appear in output');
  });

  test('contains a <style> block', () => {
    const result = htmlWrapper('T', '');
    assert.ok(result.includes('<style>'), 'should contain inline <style>');
  });

  test('contains @media print rule', () => {
    const result = htmlWrapper('T', '');
    assert.ok(result.includes('@media print'), 'should contain @media print rule');
  });

  test('escapes HTML in title', () => {
    const result = htmlWrapper('<dangerous>', '');
    assert.ok(!result.includes('<title><dangerous>'), 'title should be escaped');
    assert.ok(result.includes('&lt;dangerous&gt;'), 'escaped title should appear');
  });
});

// ── htmlSection ────────────────────────────────────────────────────────────

describe('htmlSection', () => {
  test('contains the section title', () => {
    const result = htmlSection('Audit Timeline', '<p>events</p>');
    assert.ok(result.includes('Audit Timeline'), 'section should contain its title');
  });

  test('contains the content', () => {
    const result = htmlSection('Title', '<p>my content</p>');
    assert.ok(result.includes('<p>my content</p>'), 'section should contain its content');
  });

  test('wraps in a div with report-section class', () => {
    const result = htmlSection('T', 'C');
    assert.ok(result.includes('class="report-section"'), 'should have report-section class');
  });
});

// ── escapeHtml ─────────────────────────────────────────────────────────────

describe('escapeHtml', () => {
  test('escapes ampersand', () => {
    assert.equal(escapeHtml('a & b'), 'a &amp; b');
  });

  test('escapes less-than', () => {
    assert.equal(escapeHtml('<b>'), '&lt;b&gt;');
  });

  test('escapes double quotes', () => {
    assert.equal(escapeHtml('"hello"'), '&quot;hello&quot;');
  });

  test('handles null gracefully', () => {
    assert.equal(escapeHtml(null), '');
  });

  test('handles undefined gracefully', () => {
    assert.equal(escapeHtml(undefined), '');
  });

  test('leaves safe text unchanged', () => {
    assert.equal(escapeHtml('hello world 123'), 'hello world 123');
  });
});
