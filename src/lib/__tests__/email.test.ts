import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { inviteEmailTemplate, approvalNeededEmailTemplate, runCompletedEmailTemplate } from '../email/templates';
import { sendEmail } from '../email/sender';
import { dispatchEmail } from '../email/dispatch';

describe('email templates', () => {
  it('inviteEmailTemplate returns subject with "invited"', () => {
    const result = inviteEmailTemplate('user@example.com', 'https://example.com/invite/123', 'admin');
    assert.ok(result.subject.toLowerCase().includes('invited'));
  });

  it('approvalNeededEmailTemplate includes task title in subject', () => {
    const result = approvalNeededEmailTemplate('My Task', 'task-123', 'Alice');
    assert.ok(result.subject.includes('My Task'));
  });

  it('runCompletedEmailTemplate includes status in subject', () => {
    const result = runCompletedEmailTemplate('My Task', 'task-123', 'succeeded');
    assert.ok(result.subject.includes('succeeded'));
  });

  it('templates return html and text fields', () => {
    const invite = inviteEmailTemplate('u@e.com', 'https://url', 'viewer');
    assert.ok(typeof invite.html === 'string' && invite.html.length > 0);
    assert.ok(typeof invite.text === 'string' && invite.text.length > 0);
  });
});

describe('sendEmail', () => {
  it('with provider=log returns { ok: true }', async () => {
    process.env.EMAIL_PROVIDER = 'log';
    const result = await sendEmail({ to: 'a@b.com', subject: 'Test', html: '<p>Test</p>', text: 'Test' });
    assert.deepEqual(result, { ok: true });
  });
});

describe('dispatchEmail', () => {
  it('does not throw for invite event', async () => {
    process.env.EMAIL_PROVIDER = 'log';
    await assert.doesNotReject(
      dispatchEmail({ type: 'invite', to: 'a@b.com', inviteUrl: 'https://url', role: 'admin' })
    );
  });
});
