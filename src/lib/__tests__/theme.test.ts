import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// Test the theme persistence key format (mirrors ThemeToggle logic)
function getThemeStorageKey() { return 'cda.theme'; }
function encodeTheme(theme: string) { return JSON.stringify({ v: 1, data: theme }); }
function decodeTheme(raw: string): string | null {
  try { const p = JSON.parse(raw); return p?.data ?? null; } catch { return null; }
}

describe('theme storage format', () => {
  test('key is cda.theme', () => assert.equal(getThemeStorageKey(), 'cda.theme'));
  test('encoded theme round-trips', () => {
    assert.equal(decodeTheme(encodeTheme('dark')), 'dark');
    assert.equal(decodeTheme(encodeTheme('light')), 'light');
  });
  test('invalid JSON returns null', () => assert.equal(decodeTheme('not-json'), null));
  test('missing data field returns null', () => assert.equal(decodeTheme('{"v":1}'), null));
});
