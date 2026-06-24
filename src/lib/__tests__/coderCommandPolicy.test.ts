import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isCommandAllowed,
  isWorkdirAllowed,
  scrubLogLine,
  scrubLogLines,
  validateCommandPolicyBody,
  validateCommandPolicyPatch,
} from '../coder/commandPolicy.js';

// ── isCommandAllowed ──────────────────────────────────────────────────────────

describe('isCommandAllowed — happy paths', () => {
  test('allows command matching exact prefix', () => {
    const r = isCommandAllowed('claude --print hello', ['claude --print']);
    assert.equal(r.allowed, true);
  });

  test('allows command equal to prefix', () => {
    const r = isCommandAllowed('claude --print', ['claude --print']);
    assert.equal(r.allowed, true);
  });

  test('checks all prefixes in list', () => {
    const r = isCommandAllowed('git diff', ['claude --print', 'git diff']);
    assert.equal(r.allowed, true);
  });

  test('strips extra whitespace before comparing', () => {
    const r = isCommandAllowed('  claude   --print  foo  ', ['claude --print']);
    assert.equal(r.allowed, true);
  });
});

describe('isCommandAllowed — rejections', () => {
  test('rejects command not in allowlist', () => {
    const r = isCommandAllowed('rm -rf /', ['claude --print']);
    assert.equal(r.allowed, false);
    assert.ok(r.reason);
  });

  test('rejects with empty allowlist', () => {
    const r = isCommandAllowed('claude --print', []);
    assert.equal(r.allowed, false);
    assert.match(r.reason!, /Allowlist is empty/);
  });

  test('rejects empty command', () => {
    const r = isCommandAllowed('   ', ['claude']);
    assert.equal(r.allowed, false);
    assert.match(r.reason!, /Empty command/);
  });

  test('does not match prefix that is a substring without separator', () => {
    // 'claudex' should not match prefix 'claude'
    const r = isCommandAllowed('claudex --foo', ['claude']);
    assert.equal(r.allowed, false);
  });

  test('skips blank entries in allowlist', () => {
    const r = isCommandAllowed('rm -rf /', ['', '  ']);
    assert.equal(r.allowed, false);
  });
});

// ── isWorkdirAllowed ──────────────────────────────────────────────────────────

describe('isWorkdirAllowed — happy paths', () => {
  test('allows exact base path match', () => {
    const r = isWorkdirAllowed('/home/user/repos', ['/home/user/repos']);
    assert.equal(r.allowed, true);
  });

  test('allows path under a base', () => {
    const r = isWorkdirAllowed('/home/user/repos/myproject', ['/home/user/repos']);
    assert.equal(r.allowed, true);
  });

  test('allows path under second base in list', () => {
    const r = isWorkdirAllowed('/opt/work/project', ['/home/user', '/opt/work']);
    assert.equal(r.allowed, true);
  });

  test('strips trailing slash from base before comparing', () => {
    const r = isWorkdirAllowed('/home/user/repos/foo', ['/home/user/repos/']);
    assert.equal(r.allowed, true);
  });
});

describe('isWorkdirAllowed — rejections', () => {
  test('rejects path outside all bases', () => {
    const r = isWorkdirAllowed('/tmp/evil', ['/home/user/repos']);
    assert.equal(r.allowed, false);
    assert.ok(r.reason);
  });

  test('rejects empty workdir', () => {
    const r = isWorkdirAllowed('', ['/home/user']);
    assert.equal(r.allowed, false);
    assert.match(r.reason!, /empty/i);
  });

  test('rejects with no allowed bases', () => {
    const r = isWorkdirAllowed('/home/user', []);
    assert.equal(r.allowed, false);
    assert.match(r.reason!, /No allowed base paths/);
  });

  test('does not allow prefix attack (/home/user2 under /home/user)', () => {
    const r = isWorkdirAllowed('/home/user2/evil', ['/home/user']);
    assert.equal(r.allowed, false);
  });
});

// ── scrubLogLine ──────────────────────────────────────────────────────────────

describe('scrubLogLine — passthrough', () => {
  test('returns clean line unchanged', () => {
    const line = 'Starting Claude Code run on main branch';
    assert.equal(scrubLogLine(line), line);
  });

  test('returns empty string unchanged', () => {
    assert.equal(scrubLogLine(''), '');
  });
});

describe('scrubLogLine — redaction', () => {
  test('redacts api_key=value pattern', () => {
    const result = scrubLogLine('api_key=abc123defghij');
    assert.ok(result.includes('[REDACTED]'), `Expected [REDACTED] in: ${result}`);
    assert.ok(!result.includes('abc123defghij'));
  });

  test('redacts GitHub PAT (ghp_ prefix)', () => {
    const result = scrubLogLine('token: ghp_ABCDEFGHIJKLMNOPQRSTU1234567890');
    assert.ok(result.includes('[REDACTED]'), `Expected [REDACTED] in: ${result}`);
    assert.ok(!result.includes('ghp_'));
  });

  test('redacts anthropic sk-ant key', () => {
    const result = scrubLogLine('key=sk-ant-abcdefghijklmnopqrstu1234567');
    assert.ok(result.includes('[REDACTED]'), `Expected [REDACTED] in: ${result}`);
  });

  test('redacts Authorization Bearer header value', () => {
    const result = scrubLogLine('Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9abc');
    assert.ok(result.includes('[REDACTED]'), `Expected [REDACTED] in: ${result}`);
  });

  test('redacts password= pattern', () => {
    const result = scrubLogLine('password=s3cr3tP@ss!word99');
    assert.ok(result.includes('[REDACTED]'), `Expected [REDACTED] in: ${result}`);
  });

  test('preserves the rest of the line when redacting', () => {
    const result = scrubLogLine('Running task with api_key=hunter2 in prod');
    assert.ok(result.includes('Running task with'));
    assert.ok(result.includes('[REDACTED]'));
    assert.ok(result.includes('in prod') || result.includes('[REDACTED]'));
  });
});

describe('scrubLogLines — array wrapper', () => {
  test('maps over log lines preserving ts field', () => {
    const lines = [
      { ts: '2026-06-21T10:00:00.000Z', line: 'safe line' },
      { ts: '2026-06-21T10:00:01.000Z', line: 'token=secret123456789' },
    ];
    const result = scrubLogLines(lines);
    assert.equal(result.length, 2);
    assert.equal(result[0].ts, lines[0].ts);
    assert.equal(result[0].line, 'safe line');
    assert.equal(result[1].ts, lines[1].ts);
    assert.ok(result[1].line.includes('[REDACTED]'));
  });

  test('returns empty array for empty input', () => {
    assert.deepEqual(scrubLogLines([]), []);
  });
});

// ── validateCommandPolicyBody ─────────────────────────────────────────────────

describe('validateCommandPolicyBody — valid', () => {
  const base = { name: 'Test', commandPrefixes: ['claude'], allowedWorkdirs: ['/home'], scrubLogs: true, enabled: true };

  test('accepts minimal valid body', () => {
    const result = validateCommandPolicyBody(base);
    assert.equal(result.name, 'Test');
    assert.deepEqual(result.commandPrefixes, ['claude']);
    assert.deepEqual(result.allowedWorkdirs, ['/home']);
    assert.equal(result.scrubLogs, true);
    assert.equal(result.enabled, true);
  });

  test('accepts optional description', () => {
    const result = validateCommandPolicyBody({ ...base, description: 'A description' });
    assert.equal(result.description, 'A description');
  });

  test('trims name whitespace', () => {
    const result = validateCommandPolicyBody({ ...base, name: '  Trimmed  ' });
    assert.equal(result.name, 'Trimmed');
  });
});

describe('validateCommandPolicyBody — rejections', () => {
  const base = { name: 'Test', commandPrefixes: [], allowedWorkdirs: [], scrubLogs: true, enabled: true };

  test('rejects null body', () => {
    assert.throws(() => validateCommandPolicyBody(null), /JSON object/);
  });

  test('rejects missing name', () => {
    assert.throws(() => validateCommandPolicyBody({ ...base, name: '' }), /name is required/);
  });

  test('rejects name over 120 chars', () => {
    assert.throws(() => validateCommandPolicyBody({ ...base, name: 'x'.repeat(121) }), /name exceeds/);
  });

  test('rejects non-boolean scrubLogs', () => {
    assert.throws(() => validateCommandPolicyBody({ ...base, scrubLogs: 'yes' }), /boolean/);
  });

  test('rejects non-boolean enabled', () => {
    assert.throws(() => validateCommandPolicyBody({ ...base, enabled: 1 }), /boolean/);
  });

  test('rejects non-absolute workdir', () => {
    assert.throws(() => validateCommandPolicyBody({ ...base, allowedWorkdirs: ['relative/path'] }), /absolute path/);
  });

  test('rejects blank command prefix', () => {
    assert.throws(() => validateCommandPolicyBody({ ...base, commandPrefixes: ['  '] }), /blank/);
  });
});

// ── validateCommandPolicyPatch ────────────────────────────────────────────────

describe('validateCommandPolicyPatch', () => {
  test('accepts partial update (enabled only)', () => {
    const result = validateCommandPolicyPatch({ enabled: false });
    assert.equal(result.enabled, false);
  });

  test('accepts scrubLogs toggle', () => {
    const result = validateCommandPolicyPatch({ scrubLogs: false });
    assert.equal(result.scrubLogs, false);
  });

  test('accepts commandPrefixes update', () => {
    const result = validateCommandPolicyPatch({ commandPrefixes: ['git', 'npm'] });
    assert.deepEqual(result.commandPrefixes, ['git', 'npm']);
  });

  test('rejects empty patch object', () => {
    assert.throws(() => validateCommandPolicyPatch({}), /No valid fields/);
  });

  test('rejects non-boolean scrubLogs', () => {
    assert.throws(() => validateCommandPolicyPatch({ scrubLogs: 'true' }), /boolean/);
  });

  test('rejects relative path in workdirs', () => {
    assert.throws(() => validateCommandPolicyPatch({ allowedWorkdirs: ['../escape'] }), /absolute path/);
  });
});
