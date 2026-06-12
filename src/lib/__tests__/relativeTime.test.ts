import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { relativeTime } from '../relativeTime.js';

function ago(ms: number): Date {
  return new Date(Date.now() - ms);
}

const SEC  = 1_000;
const MIN  = 60 * SEC;
const HR   = 60 * MIN;
const DAY  = 24 * HR;
const WK   = 7  * DAY;
const MO   = 30 * DAY;

describe('relativeTime', () => {
  test('returns "just now" for times less than 60 seconds ago', () => {
    assert.equal(relativeTime(ago(30 * SEC)), 'just now');
  });

  test('returns "just now" for 0 ms difference', () => {
    assert.equal(relativeTime(new Date()), 'just now');
  });

  test('returns singular "minute" for exactly 1 minute ago', () => {
    assert.equal(relativeTime(ago(1 * MIN)), '1 minute ago');
  });

  test('returns plural "minutes" for 5 minutes ago', () => {
    assert.equal(relativeTime(ago(5 * MIN)), '5 minutes ago');
  });

  test('returns singular "hour" for exactly 1 hour ago', () => {
    assert.equal(relativeTime(ago(1 * HR)), '1 hour ago');
  });

  test('returns plural "hours" for 2 hours ago', () => {
    assert.equal(relativeTime(ago(2 * HR)), '2 hours ago');
  });

  test('returns "days ago" for 3 days ago', () => {
    assert.equal(relativeTime(ago(3 * DAY)), '3 days ago');
  });

  test('returns "weeks ago" for 2 weeks ago', () => {
    assert.equal(relativeTime(ago(2 * WK)), '2 weeks ago');
  });

  test('returns "months ago" for 1 month ago', () => {
    assert.equal(relativeTime(ago(1 * MO)), '1 month ago');
  });

  test('returns "months ago" for 2 months ago', () => {
    assert.equal(relativeTime(ago(2 * MO)), '2 months ago');
  });
});
