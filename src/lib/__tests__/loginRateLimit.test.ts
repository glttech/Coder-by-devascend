import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { checkLoginRateLimit, resetLoginRateLimit } from '../loginRateLimit.js';

const IP = '1.2.3.4';
const OTHER_IP = '9.8.7.6';

describe('checkLoginRateLimit', () => {
  beforeEach(() => {
    resetLoginRateLimit(IP);
    resetLoginRateLimit(OTHER_IP);
  });

  test('first attempt is allowed', () => {
    const result = checkLoginRateLimit(IP, 1000);
    assert.equal(result.allowed, true);
    assert.equal(result.remainingAttempts, 4);
    assert.equal(result.retryAfterMs, 0);
  });

  test('five consecutive attempts are all allowed', () => {
    for (let i = 0; i < 5; i++) {
      const result = checkLoginRateLimit(IP, 1000 + i);
      assert.equal(result.allowed, true);
    }
  });

  test('sixth attempt within window is blocked', () => {
    for (let i = 0; i < 5; i++) checkLoginRateLimit(IP, 1000);
    const result = checkLoginRateLimit(IP, 2000);
    assert.equal(result.allowed, false);
    assert.equal(result.remainingAttempts, 0);
    assert.ok(result.retryAfterMs > 0);
  });

  test('new window resets the counter', () => {
    for (let i = 0; i < 5; i++) checkLoginRateLimit(IP, 0);
    // Advance past 15-minute window
    const afterWindow = 16 * 60 * 1000;
    const result = checkLoginRateLimit(IP, afterWindow);
    assert.equal(result.allowed, true);
  });

  test('different IPs have independent buckets', () => {
    for (let i = 0; i < 5; i++) checkLoginRateLimit(IP, 1000);
    checkLoginRateLimit(IP, 2000); // 6th = blocked
    const other = checkLoginRateLimit(OTHER_IP, 2000);
    assert.equal(other.allowed, true);
  });

  test('resetLoginRateLimit clears bucket', () => {
    for (let i = 0; i < 5; i++) checkLoginRateLimit(IP, 1000);
    resetLoginRateLimit(IP);
    const result = checkLoginRateLimit(IP, 2000);
    assert.equal(result.allowed, true);
  });
});
