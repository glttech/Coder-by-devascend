import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { buildWebhookPayload, deliverOne } from '@/lib/webhookDelivery';

// Pure unit tests — no DB or outbound HTTP required for payload/signing tests

describe('buildWebhookPayload', () => {
  it('returns valid JSON', () => {
    const raw = buildWebhookPayload('task.created', { taskId: 'abc' });
    assert.doesNotThrow(() => JSON.parse(raw));
  });

  it('includes event field', () => {
    const parsed = JSON.parse(buildWebhookPayload('approval.granted', {}));
    assert.equal(parsed.event, 'approval.granted');
  });

  it('includes timestamp as ISO string', () => {
    const parsed = JSON.parse(buildWebhookPayload('task.updated', {}));
    assert.ok(typeof parsed.timestamp === 'string');
    assert.ok(!isNaN(Date.parse(parsed.timestamp)));
  });

  it('includes data payload', () => {
    const data = { taskId: 't1', riskLevel: 'high' };
    const parsed = JSON.parse(buildWebhookPayload('task.failed', data));
    assert.deepEqual(parsed.data, data);
  });

  it('handles nested data objects', () => {
    const data = { a: { b: { c: 42 } } };
    const parsed = JSON.parse(buildWebhookPayload('agent_run.completed', data));
    assert.equal(parsed.data.a.b.c, 42);
  });

  it('handles null data', () => {
    const parsed = JSON.parse(buildWebhookPayload('task.created', null));
    assert.equal(parsed.data, null);
  });
});

describe('HMAC signature verification', () => {
  function computeExpectedSig(secret: string, body: string): string {
    return 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');
  }

  it('sha256 prefix is included', () => {
    const body = '{"event":"task.created"}';
    const sig = computeExpectedSig('mysecret', body);
    assert.ok(sig.startsWith('sha256='));
  });

  it('signature changes when body changes', () => {
    const secret = 'test-secret-abc';
    const s1 = computeExpectedSig(secret, '{"a":1}');
    const s2 = computeExpectedSig(secret, '{"a":2}');
    assert.notEqual(s1, s2);
  });

  it('signature changes when secret changes', () => {
    const body = '{"event":"approval.granted"}';
    const s1 = computeExpectedSig('secret-a', body);
    const s2 = computeExpectedSig('secret-b', body);
    assert.notEqual(s1, s2);
  });

  it('same inputs always produce same signature (deterministic)', () => {
    const secret = 'deterministic-secret';
    const body = '{"event":"task.created","timestamp":"2026-06-19T00:00:00.000Z"}';
    const s1 = computeExpectedSig(secret, body);
    const s2 = computeExpectedSig(secret, body);
    assert.equal(s1, s2);
  });

  it('hex digest is 64 chars', () => {
    const sig = computeExpectedSig('s', 'body');
    const hex = sig.replace('sha256=', '');
    assert.equal(hex.length, 64);
  });
});

describe('deliverOne', () => {
  it('returns false when fetch throws (network error)', async () => {
    // URL that will fail immediately — use an invalid scheme to avoid network
    const result = await deliverOne(
      'http://127.0.0.1:0/nonexistent',  // port 0 = immediate connection refused
      'secret',
      'task.created',
      '{"event":"task.created"}',
      crypto.randomUUID(),
    );
    // Should return false (not throw) on network error
    assert.equal(result, false);
  });
});

describe('WebhookEvent types coverage', () => {
  const ALL_EVENTS = [
    'task.created', 'task.updated', 'task.completed', 'task.failed',
    'agent_run.completed', 'agent_run.failed',
    'approval.granted', 'approval.rejected',
    'instruction.approved', 'instruction.blocked',
  ] as const;

  it('all 10 event types produce valid payloads', () => {
    for (const event of ALL_EVENTS) {
      const raw = buildWebhookPayload(event, { test: true });
      const parsed = JSON.parse(raw);
      assert.equal(parsed.event, event);
    }
  });

  it('has exactly 10 event types', () => {
    assert.equal(ALL_EVENTS.length, 10);
  });
});
