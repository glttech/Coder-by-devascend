import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  COMPETITORS,
  FEATURE_DEFS,
  FEATURE_KEYS,
  VALID_STATUSES,
  STATUS_CONFIG,
  buildMatrix,
} from '../competitiveMatrix.js';

// ── Static definitions ─────────────────────────────────────────────────────────

describe('COMPETITORS', () => {
  test('includes Coder as the first entry', () => {
    assert.equal(COMPETITORS[0], 'Coder');
  });

  test('includes all expected competitors', () => {
    for (const c of ['GitHub Copilot', 'OpenAI Codex', 'Gemini Code Assist', 'Claude Code', 'OpenClaw']) {
      assert.ok(COMPETITORS.includes(c as never), `missing: ${c}`);
    }
  });

  test('has at least 6 competitors', () => {
    assert.ok(COMPETITORS.length >= 6);
  });
});

describe('FEATURE_DEFS', () => {
  test('has exactly 10 features', () => {
    assert.equal(FEATURE_DEFS.length, 10);
  });

  test('each def has key, label, and description', () => {
    for (const fd of FEATURE_DEFS) {
      assert.ok(fd.key.length > 0, 'key must not be empty');
      assert.ok(fd.label.length > 0, 'label must not be empty');
      assert.ok(fd.description.length > 0, 'description must not be empty');
    }
  });

  test('all expected feature keys are present', () => {
    const expected = [
      'pr_memory', 'audit_trail', 'approval_gates', 'evidence_pack',
      'incident_mode', 'org_rbac', 'api_keys', 'reports',
      'agent_execution', 'sandbox_preview',
    ];
    for (const k of expected) {
      assert.ok(FEATURE_KEYS.includes(k), `missing featureKey: ${k}`);
    }
  });

  test('feature keys are unique', () => {
    const unique = new Set(FEATURE_KEYS);
    assert.equal(unique.size, FEATURE_KEYS.length);
  });
});

describe('VALID_STATUSES', () => {
  test('contains exactly 4 statuses', () => {
    assert.equal(VALID_STATUSES.length, 4);
  });

  test('contains yes, no, partial, unknown', () => {
    for (const s of ['yes', 'no', 'partial', 'unknown']) {
      assert.ok(VALID_STATUSES.includes(s as never), `missing status: ${s}`);
    }
  });
});

describe('STATUS_CONFIG', () => {
  test('every valid status has a config entry', () => {
    for (const s of VALID_STATUSES) {
      const cfg = STATUS_CONFIG[s];
      assert.ok(cfg, `missing config for ${s}`);
      assert.ok(cfg.label.length > 0);
      assert.ok(cfg.color.length > 0);
      assert.ok(cfg.bg.length > 0);
    }
  });

  test('yes has green color indicator', () => {
    assert.ok(STATUS_CONFIG.yes.color.includes('green'));
  });

  test('no has red color indicator', () => {
    assert.ok(STATUS_CONFIG.no.color.includes('red'));
  });

  test('partial has amber color indicator', () => {
    assert.ok(STATUS_CONFIG.partial.color.includes('amber'));
  });
});

// ── buildMatrix ────────────────────────────────────────────────────────────────

describe('buildMatrix', () => {
  test('returns one row per feature', () => {
    const rows = buildMatrix([]);
    assert.equal(rows.length, FEATURE_DEFS.length);
  });

  test('all cells default to unknown when no records', () => {
    const rows = buildMatrix([]);
    for (const row of rows) {
      for (const c of COMPETITORS) {
        assert.equal(row.cells[c].status, 'unknown');
        assert.equal(row.cells[c].notes, null);
      }
    }
  });

  test('populated record is reflected in the correct cell', () => {
    const rows = buildMatrix([
      { competitor: 'Coder', featureKey: 'pr_memory', status: 'yes', notes: 'Full support' },
    ]);
    const prRow = rows.find((r) => r.featureKey === 'pr_memory');
    assert.ok(prRow);
    assert.equal(prRow.cells['Coder'].status, 'yes');
    assert.equal(prRow.cells['Coder'].notes, 'Full support');
    // Other competitors remain unknown
    assert.equal(prRow.cells['GitHub Copilot'].status, 'unknown');
  });

  test('multiple records populate independently', () => {
    const rows = buildMatrix([
      { competitor: 'Coder',         featureKey: 'audit_trail', status: 'yes',     notes: null },
      { competitor: 'GitHub Copilot', featureKey: 'audit_trail', status: 'no',      notes: null },
      { competitor: 'OpenAI Codex',   featureKey: 'audit_trail', status: 'partial', notes: 'Limited' },
    ]);
    const row = rows.find((r) => r.featureKey === 'audit_trail');
    assert.ok(row);
    assert.equal(row.cells['Coder'].status, 'yes');
    assert.equal(row.cells['GitHub Copilot'].status, 'no');
    assert.equal(row.cells['OpenAI Codex'].status, 'partial');
    assert.equal(row.cells['OpenAI Codex'].notes, 'Limited');
    assert.equal(row.cells['Gemini Code Assist'].status, 'unknown');
  });

  test('unknown status for unrecognised status value', () => {
    const rows = buildMatrix([
      { competitor: 'Coder', featureKey: 'api_keys', status: 'maybe', notes: null },
    ]);
    const row = rows.find((r) => r.featureKey === 'api_keys');
    assert.ok(row);
    assert.equal(row.cells['Coder'].status, 'unknown');
  });

  test('row has featureLabel and featureDescription set', () => {
    const rows = buildMatrix([]);
    const row = rows.find((r) => r.featureKey === 'approval_gates');
    assert.ok(row);
    assert.equal(row.featureLabel, 'Approval Gates');
    assert.ok(row.featureDescription.length > 0);
  });

  test('each row has a cell for every competitor', () => {
    const rows = buildMatrix([]);
    for (const row of rows) {
      for (const c of COMPETITORS) {
        assert.ok(c in row.cells, `missing cell for competitor: ${c}`);
      }
    }
  });

  test('records for unknown competitors are silently ignored', () => {
    const rows = buildMatrix([
      { competitor: 'Unknown Vendor', featureKey: 'pr_memory', status: 'yes', notes: null },
    ]);
    const row = rows.find((r) => r.featureKey === 'pr_memory');
    assert.ok(row);
    assert.equal(row.cells['Coder'].status, 'unknown');
  });
});

// ── API validation (mirrored from route) ──────────────────────────────────────

describe('API validation helpers', () => {
  function validateUpsert(body: Record<string, unknown>) {
    if (!COMPETITORS.includes(body.competitor as never)) {
      return { ok: false, error: 'Invalid competitor', status: 422 };
    }
    if (!FEATURE_KEYS.includes(body.featureKey as string)) {
      return { ok: false, error: 'Invalid featureKey', status: 422 };
    }
    if (!VALID_STATUSES.includes(body.status as never)) {
      return { ok: false, error: 'Invalid status', status: 422 };
    }
    return { ok: true };
  }

  test('accepts valid upsert body', () => {
    const r = validateUpsert({ competitor: 'Coder', featureKey: 'pr_memory', status: 'yes' });
    assert.equal(r.ok, true);
  });

  test('rejects unknown competitor', () => {
    const r = validateUpsert({ competitor: 'Acme Corp', featureKey: 'pr_memory', status: 'yes' });
    assert.equal(r.ok, false);
    assert.match(r.error!, /competitor/i);
  });

  test('rejects unknown featureKey', () => {
    const r = validateUpsert({ competitor: 'Coder', featureKey: 'magic_wand', status: 'yes' });
    assert.equal(r.ok, false);
    assert.match(r.error!, /featureKey/i);
  });

  test('rejects unknown status', () => {
    const r = validateUpsert({ competitor: 'Coder', featureKey: 'pr_memory', status: 'maybe' });
    assert.equal(r.ok, false);
    assert.match(r.error!, /status/i);
  });

  test('accepts all valid statuses', () => {
    for (const s of VALID_STATUSES) {
      const r = validateUpsert({ competitor: 'Coder', featureKey: 'pr_memory', status: s });
      assert.equal(r.ok, true, `should accept status: ${s}`);
    }
  });

  test('accepts all competitors', () => {
    for (const c of COMPETITORS) {
      const r = validateUpsert({ competitor: c, featureKey: 'pr_memory', status: 'unknown' });
      assert.equal(r.ok, true, `should accept competitor: ${c}`);
    }
  });
});
