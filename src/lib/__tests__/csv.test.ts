import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { escapeCsvCell, buildCsvRow, buildCsv } from '../csv.js';

describe('escapeCsvCell', () => {
  test('plain string passes through', () => assert.equal(escapeCsvCell('hello'), 'hello'));
  test('null becomes empty string', () => assert.equal(escapeCsvCell(null), ''));
  test('undefined becomes empty string', () => assert.equal(escapeCsvCell(undefined), ''));
  test('Date becomes ISO string', () => {
    const d = new Date('2024-01-15T12:00:00Z');
    assert.ok(escapeCsvCell(d).includes('2024-01-15'));
  });
  test('comma triggers quoting', () => assert.equal(escapeCsvCell('a,b'), '"a,b"'));
  test('quote is doubled and quoted', () => assert.equal(escapeCsvCell('say "hi"'), '"say ""hi"""'));
  test('= prefix gets single-quote prefix (injection hardening)', () => assert.equal(escapeCsvCell('=SUM(A1)'), "'=SUM(A1)"));
  test('+ prefix gets single-quote prefix', () => assert.equal(escapeCsvCell('+1'), "'+1"));
  test('- prefix gets single-quote prefix', () => assert.equal(escapeCsvCell('-1'), "'-1"));
  test('@ prefix gets single-quote prefix', () => assert.equal(escapeCsvCell('@A1'), "'@A1"));
  test('number converts to string', () => assert.equal(escapeCsvCell(42), '42'));
});

describe('buildCsvRow', () => {
  test('joins cells with comma', () => assert.equal(buildCsvRow(['a', 'b', 'c']), 'a,b,c'));
  test('handles mixed types', () => assert.equal(buildCsvRow(['name', 42, null]), 'name,42,'));
});

describe('buildCsv', () => {
  test('header row is first', () => {
    const csv = buildCsv(['A', 'B'], [['1', '2']]);
    assert.ok(csv.startsWith('A,B\r\n'));
  });
  test('rows use CRLF', () => {
    const csv = buildCsv(['X'], [['1'], ['2']]);
    assert.ok(csv.includes('\r\n'));
  });
  test('empty rows returns header only', () => {
    const csv = buildCsv(['Col'], []);
    assert.equal(csv, 'Col');
  });
});
