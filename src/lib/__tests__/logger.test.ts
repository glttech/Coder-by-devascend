import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { log } from '../logger.js';

// ── logger — structured JSON output ────────────────────────────────────────

describe('log.info — emits JSON with correct keys', () => {
  let captured: string[] = [];
  const originalLog = console.log;

  beforeEach(() => {
    captured = [];
    console.log = (line: string) => captured.push(line);
  });

  afterEach(() => {
    console.log = originalLog;
  });

  test('emits a single JSON line with ts, level, event', () => {
    log.info('test_event');
    assert.equal(captured.length, 1);
    const parsed = JSON.parse(captured[0]);
    assert.equal(typeof parsed.ts, 'string');
    assert.equal(parsed.level, 'info');
    assert.equal(parsed.event, 'test_event');
  });

  test('log.warn sets level to warn', () => {
    log.warn('warn_event');
    const parsed = JSON.parse(captured[0]);
    assert.equal(parsed.level, 'warn');
  });

  test('log.error sets level to error', () => {
    log.error('error_event');
    const parsed = JSON.parse(captured[0]);
    assert.equal(parsed.level, 'error');
  });

  test('unknown fields pass through unchanged', () => {
    log.info('test_event', { userId: 'abc123', action: 'login' });
    const parsed = JSON.parse(captured[0]);
    assert.equal(parsed.userId, 'abc123');
    assert.equal(parsed.action, 'login');
  });
});

describe('log — secret field redaction', () => {
  let captured: string[] = [];
  const originalLog = console.log;

  beforeEach(() => {
    captured = [];
    console.log = (line: string) => captured.push(line);
  });

  afterEach(() => {
    console.log = originalLog;
  });

  test('password field is redacted', () => {
    log.info('user_login', { username: 'alice', password: 'supersecret' });
    const parsed = JSON.parse(captured[0]);
    assert.equal(parsed.password, '[REDACTED]');
    assert.equal(parsed.username, 'alice');
  });

  test('token field is redacted', () => {
    log.info('api_call', { token: 'abc123token' });
    const parsed = JSON.parse(captured[0]);
    assert.equal(parsed.token, '[REDACTED]');
  });

  test('secret field is redacted', () => {
    log.info('config_load', { secret: 'mysecret' });
    const parsed = JSON.parse(captured[0]);
    assert.equal(parsed.secret, '[REDACTED]');
  });

  test('cookie field is redacted', () => {
    log.info('request', { cookie: 'session=xyz' });
    const parsed = JSON.parse(captured[0]);
    assert.equal(parsed.cookie, '[REDACTED]');
  });

  test('authorization field is redacted', () => {
    log.info('request', { authorization: 'Bearer tok' });
    const parsed = JSON.parse(captured[0]);
    assert.equal(parsed.authorization, '[REDACTED]');
  });

  test('passwordHash field is redacted', () => {
    log.info('user_created', { passwordHash: '$2b$12$hash' });
    const parsed = JSON.parse(captured[0]);
    assert.equal(parsed.passwordHash, '[REDACTED]');
  });
});
