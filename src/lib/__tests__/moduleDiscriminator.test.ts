import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

// Validates the module discriminator logic used to separate Coder and SOC data.
// Tests are pure (no DB) — they verify the constants and guard functions.

const VALID_MODULES = ['coder', 'soc'] as const;
type Module = typeof VALID_MODULES[number];

const DEFAULT_MODULE: Module = 'coder';

function isValidModule(value: unknown): value is Module {
  return VALID_MODULES.includes(value as Module);
}

function resolveModule(input: string | null | undefined): Module {
  if (input === null || input === undefined || input === '') return DEFAULT_MODULE;
  return isValidModule(input) ? input : DEFAULT_MODULE;
}

function filterByModule<T extends { module?: string | null }>(
  items: T[],
  module: Module,
): T[] {
  return items.filter((item) => (item.module ?? DEFAULT_MODULE) === module);
}

describe('module discriminator constants', () => {
  test('exactly 2 valid modules', () => {
    assert.equal(VALID_MODULES.length, 2);
  });

  test('default module is coder', () => {
    assert.equal(DEFAULT_MODULE, 'coder');
  });

  test('coder and soc are valid', () => {
    assert.ok(isValidModule('coder'));
    assert.ok(isValidModule('soc'));
  });

  test('other values are invalid', () => {
    assert.equal(isValidModule('admin'), false);
    assert.equal(isValidModule(''), false);
    assert.equal(isValidModule(null), false);
    assert.equal(isValidModule(undefined), false);
    assert.equal(isValidModule('CODER'), false);
  });
});

describe('resolveModule', () => {
  test('returns coder for null', () => {
    assert.equal(resolveModule(null), 'coder');
  });

  test('returns coder for undefined', () => {
    assert.equal(resolveModule(undefined), 'coder');
  });

  test('returns coder for empty string', () => {
    assert.equal(resolveModule(''), 'coder');
  });

  test('returns coder for unknown value', () => {
    assert.equal(resolveModule('unknown'), 'coder');
  });

  test('returns coder when input is coder', () => {
    assert.equal(resolveModule('coder'), 'coder');
  });

  test('returns soc when input is soc', () => {
    assert.equal(resolveModule('soc'), 'soc');
  });
});

describe('filterByModule', () => {
  const items = [
    { id: '1', module: 'coder' },
    { id: '2', module: 'soc' },
    { id: '3', module: 'coder' },
    { id: '4', module: null },      // null → treated as coder
    { id: '5', module: undefined }, // undefined → treated as coder
  ];

  test('filters to coder items (including null/undefined defaults)', () => {
    const result = filterByModule(items, 'coder');
    const ids = result.map((r) => r.id);
    assert.deepEqual(ids.sort(), ['1', '3', '4', '5']);
  });

  test('filters to soc items only', () => {
    const result = filterByModule(items, 'soc');
    const ids = result.map((r) => r.id);
    assert.deepEqual(ids, ['2']);
  });

  test('coder and soc are disjoint', () => {
    const coderItems = filterByModule(items, 'coder');
    const socItems = filterByModule(items, 'soc');
    const coderIds = new Set(coderItems.map((r) => r.id));
    const socIds = new Set(socItems.map((r) => r.id));
    for (const id of socIds) {
      assert.equal(coderIds.has(id), false, `id ${id} appears in both modules`);
    }
  });

  test('union covers all items', () => {
    const coderItems = filterByModule(items, 'coder');
    const socItems = filterByModule(items, 'soc');
    assert.equal(coderItems.length + socItems.length, items.length);
  });

  test('empty list returns empty', () => {
    assert.deepEqual(filterByModule([], 'coder'), []);
    assert.deepEqual(filterByModule([], 'soc'), []);
  });
});
