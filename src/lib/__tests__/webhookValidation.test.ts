import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

const VALID_WEBHOOK_EVENTS = [
  'task.created', 'task.updated', 'task.completed', 'task.failed',
  'agent_run.completed', 'agent_run.failed',
  'approval.granted', 'approval.rejected',
  'instruction.approved', 'instruction.blocked',
] as const;

const WEBHOOK_URL_MAX = 2048;
const WEBHOOK_SECRET_MAX = 256;

function validateWebhook(body: { url?: string; secret?: string; events?: string[] }): string[] {
  const errs: string[] = [];
  if (!body.url?.startsWith('https://')) errs.push('URL must start with https://');
  if (body.url && body.url.length > WEBHOOK_URL_MAX) errs.push(`URL must be ${WEBHOOK_URL_MAX} characters or fewer`);
  if (body.secret !== undefined && body.secret !== null && body.secret.length > WEBHOOK_SECRET_MAX) {
    errs.push(`secret must be ${WEBHOOK_SECRET_MAX} characters or fewer`);
  }
  if (!Array.isArray(body.events) || body.events.length === 0) {
    errs.push('Select at least one event');
  } else {
    const invalid = body.events.filter((e) => !(VALID_WEBHOOK_EVENTS as readonly string[]).includes(e));
    if (invalid.length > 0) errs.push(`Unknown event types: ${invalid.join(', ')}`);
  }
  return errs;
}

describe('webhook event allowlist', () => {
  test('exactly 10 valid event types defined', () => {
    assert.equal(VALID_WEBHOOK_EVENTS.length, 10);
  });

  test('accepts all valid events', () => {
    const errs = validateWebhook({ url: 'https://example.com/hook', events: [...VALID_WEBHOOK_EVENTS] });
    assert.deepEqual(errs, []);
  });

  test('rejects unknown event name', () => {
    const errs = validateWebhook({ url: 'https://example.com/hook', events: ['task.created', 'task.exploded'] });
    assert.ok(errs.some((e) => e.includes('task.exploded')));
  });

  test('rejects wildcard event', () => {
    const errs = validateWebhook({ url: 'https://example.com/hook', events: ['*'] });
    assert.ok(errs.some((e) => e.includes('*')));
  });

  test('rejects empty events array', () => {
    const errs = validateWebhook({ url: 'https://example.com/hook', events: [] });
    assert.ok(errs.some((e) => e.includes('at least one')));
  });

  test('all task.* events are in allowlist', () => {
    const taskEvents = (VALID_WEBHOOK_EVENTS as readonly string[]).filter((e) => e.startsWith('task.'));
    assert.equal(taskEvents.length, 4);
  });

  test('all agent_run.* events are in allowlist', () => {
    const agentEvents = (VALID_WEBHOOK_EVENTS as readonly string[]).filter((e) => e.startsWith('agent_run.'));
    assert.equal(agentEvents.length, 2);
  });
});

describe('webhook URL validation', () => {
  test('rejects http:// URL', () => {
    const errs = validateWebhook({ url: 'http://example.com/hook', events: ['task.created'] });
    assert.ok(errs.some((e) => e.includes('https://')));
  });

  test('rejects URL over 2048 chars', () => {
    const longUrl = 'https://example.com/' + 'x'.repeat(2048);
    const errs = validateWebhook({ url: longUrl, events: ['task.created'] });
    assert.ok(errs.some((e) => e.includes('2048')));
  });

  test('accepts URL at exactly 2048 chars', () => {
    const url = 'https://example.com/' + 'x'.repeat(2048 - 'https://example.com/'.length);
    const errs = validateWebhook({ url, events: ['task.created'] });
    assert.deepEqual(errs, []);
  });
});

describe('webhook secret validation', () => {
  test('accepts secret at exactly 256 chars', () => {
    const errs = validateWebhook({ url: 'https://example.com/hook', secret: 'x'.repeat(256), events: ['task.created'] });
    assert.deepEqual(errs, []);
  });

  test('rejects secret over 256 chars', () => {
    const errs = validateWebhook({ url: 'https://example.com/hook', secret: 'x'.repeat(257), events: ['task.created'] });
    assert.ok(errs.some((e) => e.includes('256')));
  });

  test('accepts undefined secret', () => {
    const errs = validateWebhook({ url: 'https://example.com/hook', events: ['task.created'] });
    assert.deepEqual(errs, []);
  });
});
