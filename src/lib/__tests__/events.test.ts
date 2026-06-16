import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { publish, subscribe } from '../events/bus.js';

describe('event bus', () => {
  test('publish to a channel with no subscribers does not throw', () => {
    assert.doesNotThrow(() => {
      publish('nonexistent-channel', { type: 'test' });
    });
  });

  test('subscribe returns an unsubscribe function', () => {
    const unsubscribe = subscribe('test-channel', () => {});
    assert.equal(typeof unsubscribe, 'function');
    unsubscribe();
  });

  test('unsubscribe stops receiving events', () => {
    const received: unknown[] = [];
    const unsubscribe = subscribe('unsub-channel', (event) => {
      received.push(event);
    });

    publish('unsub-channel', { type: 'before' });
    unsubscribe();
    publish('unsub-channel', { type: 'after' });

    assert.equal(received.length, 1);
    assert.deepEqual(received[0], { type: 'before' });
  });

  test('publish delivers to multiple subscribers', () => {
    const results: string[] = [];

    const unsub1 = subscribe('multi-channel', (event) => {
      results.push(`sub1:${event.type}`);
    });
    const unsub2 = subscribe('multi-channel', (event) => {
      results.push(`sub2:${event.type}`);
    });

    publish('multi-channel', { type: 'hello' });

    unsub1();
    unsub2();

    assert.equal(results.length, 2);
    assert.ok(results.includes('sub1:hello'));
    assert.ok(results.includes('sub2:hello'));
  });

  test('after unsubscribe, publish does not call the callback', () => {
    let callCount = 0;

    const unsubscribe = subscribe('cleanup-channel', () => {
      callCount++;
    });

    publish('cleanup-channel', { type: 'first' });
    assert.equal(callCount, 1);

    unsubscribe();

    publish('cleanup-channel', { type: 'second' });
    assert.equal(callCount, 1, 'callback should not be called after unsubscribe');
  });
});
