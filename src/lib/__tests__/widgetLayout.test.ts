import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { parseLayout, toggleHidden, moveInOrder, WIDGET_KEYS_LIST } from '../widgetLayout';

describe('widgetLayout', () => {
  test('parseLayout returns default for null', () => {
    const l = parseLayout(null);
    assert.equal(l.order.length, 5);
    assert.equal(l.hidden.length, 0);
  });

  test('parseLayout returns default for invalid JSON', () => {
    const l = parseLayout('not-json');
    assert.equal(l.order.length, 5);
  });

  test('toggleHidden adds key', () => {
    const l = parseLayout(null);
    const next = toggleHidden(l, 'ci-status');
    assert.ok(next.hidden.includes('ci-status'));
  });

  test('toggleHidden removes key', () => {
    const l = { order: [...WIDGET_KEYS_LIST], hidden: ['ci-status'] as any };
    const next = toggleHidden(l, 'ci-status');
    assert.ok(!next.hidden.includes('ci-status'));
  });

  test('moveInOrder moves up', () => {
    const l = parseLayout(null);
    const next = moveInOrder(l, 'recent-runs', 'up');
    assert.equal(next.order[0], 'recent-runs');
  });

  test('moveInOrder no-op at boundary', () => {
    const l = parseLayout(null);
    const next = moveInOrder(l, 'task-summary', 'up');
    assert.equal(next.order[0], 'task-summary');
  });
});
