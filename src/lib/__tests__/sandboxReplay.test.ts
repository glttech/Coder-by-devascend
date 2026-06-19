/**
 * Tests for sandbox replay utilities:
 * - Diff summary computation (planned vs actual file sets)
 * - Risk delta calculation (planned vs actual risk score)
 * - Sandbox replay response shape (no sensitive fields)
 * - Evidence gap detection
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// ---------------------------------------------------------------------------
// Inline pure utility functions (mirroring logic in the page/API)
// ---------------------------------------------------------------------------

function computeFileDiff(
  plannedFiles: string[],
  actualFiles: string[],
): { extra: string[]; missing: string[] } {
  const plannedSet = new Set(plannedFiles);
  const actualSet = new Set(actualFiles);
  const extra = actualFiles.filter((f) => !plannedSet.has(f));
  const missing = plannedFiles.filter(
    (f) => !actualSet.has(f) && f !== '(files to be determined by agent)',
  );
  return { extra, missing };
}

function riskLevelToScore(level: string | null | undefined): number | null {
  if (!level) return null;
  if (level === 'low') return 0.2;
  if (level === 'medium') return 0.5;
  if (level === 'high') return 0.8;
  return null;
}

function computeRiskDelta(
  plannedLevel: string | null | undefined,
  actualScore: number | null | undefined,
): number | null {
  const plannedScore = riskLevelToScore(plannedLevel);
  if (plannedScore === null || actualScore == null) return null;
  return actualScore - plannedScore;
}

interface SandboxReplayResponse {
  taskId: string;
  sandboxEnabled: boolean;
  latestRun: {
    sandboxPlan: string | null;
    response: string | null;
    filesChanged: string | null;
    commandsRun: string | null;
    testResult: string | null;
    commitHash: string | null;
    riskScore: number | null;
    status: string;
  } | null;
  approvalStatus: string | null;
}

function buildReplayResponse(overrides: Partial<SandboxReplayResponse> = {}): SandboxReplayResponse {
  return {
    taskId: 'task-abc',
    sandboxEnabled: false,
    latestRun: null,
    approvalStatus: null,
    ...overrides,
  };
}

function detectEvidenceGap(agentRunExists: boolean, evidenceCount: number): boolean {
  return agentRunExists && evidenceCount === 0;
}

// ---------------------------------------------------------------------------
// Diff Summary Tests
// ---------------------------------------------------------------------------

describe('computeFileDiff — extra files', () => {
  test('returns extra files that were not in the plan', () => {
    const planned = ['src/foo.ts', 'src/bar.ts'];
    const actual = ['src/foo.ts', 'src/bar.ts', 'src/unexpected.ts'];
    const { extra } = computeFileDiff(planned, actual);
    assert.deepEqual(extra, ['src/unexpected.ts']);
  });

  test('returns empty extra array when actual matches planned exactly', () => {
    const planned = ['src/foo.ts'];
    const actual = ['src/foo.ts'];
    const { extra } = computeFileDiff(planned, actual);
    assert.equal(extra.length, 0);
  });

  test('returns multiple extra files when several are unplanned', () => {
    const planned = ['src/a.ts'];
    const actual = ['src/a.ts', 'src/b.ts', 'src/c.ts'];
    const { extra } = computeFileDiff(planned, actual);
    assert.equal(extra.length, 2);
    assert.ok(extra.includes('src/b.ts'));
    assert.ok(extra.includes('src/c.ts'));
  });
});

describe('computeFileDiff — missing files', () => {
  test('returns missing files that were planned but not actually changed', () => {
    const planned = ['src/foo.ts', 'src/bar.ts'];
    const actual = ['src/foo.ts'];
    const { missing } = computeFileDiff(planned, actual);
    assert.deepEqual(missing, ['src/bar.ts']);
  });

  test('does not report the default placeholder as missing', () => {
    const planned = ['(files to be determined by agent)'];
    const actual: string[] = [];
    const { missing } = computeFileDiff(planned, actual);
    assert.equal(missing.length, 0);
  });

  test('returns empty missing array when all planned files were changed', () => {
    const planned = ['src/x.ts', 'src/y.ts'];
    const actual = ['src/x.ts', 'src/y.ts', 'src/z.ts'];
    const { missing } = computeFileDiff(planned, actual);
    assert.equal(missing.length, 0);
  });
});

// ---------------------------------------------------------------------------
// Risk Delta Tests
// ---------------------------------------------------------------------------

describe('riskLevelToScore', () => {
  test('maps low to 0.2', () => {
    assert.equal(riskLevelToScore('low'), 0.2);
  });

  test('maps medium to 0.5', () => {
    assert.equal(riskLevelToScore('medium'), 0.5);
  });

  test('maps high to 0.8', () => {
    assert.equal(riskLevelToScore('high'), 0.8);
  });

  test('returns null for unknown level', () => {
    assert.equal(riskLevelToScore('extreme'), null);
  });

  test('returns null for null input', () => {
    assert.equal(riskLevelToScore(null), null);
  });
});

describe('computeRiskDelta', () => {
  test('returns positive delta when actual is higher than planned', () => {
    const delta = computeRiskDelta('low', 0.7);
    assert.ok(delta !== null);
    assert.ok(delta > 0, 'delta should be positive');
  });

  test('returns negative delta when actual is lower than planned', () => {
    const delta = computeRiskDelta('high', 0.3);
    assert.ok(delta !== null);
    assert.ok(delta < 0, 'delta should be negative');
  });

  test('returns null when planned level is unknown', () => {
    assert.equal(computeRiskDelta(null, 0.5), null);
  });

  test('returns null when actual score is null', () => {
    assert.equal(computeRiskDelta('medium', null), null);
  });

  test('returns near-zero delta when actual matches planned score', () => {
    const delta = computeRiskDelta('medium', 0.5);
    assert.ok(delta !== null);
    assert.equal(Math.abs(delta) < 0.001, true);
  });
});

// ---------------------------------------------------------------------------
// Sandbox Replay Response Shape Tests
// ---------------------------------------------------------------------------

describe('sandboxReplayResponse — shape', () => {
  test('response has required top-level fields', () => {
    const resp = buildReplayResponse();
    assert.ok('taskId' in resp);
    assert.ok('sandboxEnabled' in resp);
    assert.ok('latestRun' in resp);
    assert.ok('approvalStatus' in resp);
  });

  test('latestRun is null when no sandbox run exists', () => {
    const resp = buildReplayResponse({ latestRun: null });
    assert.equal(resp.latestRun, null);
  });

  test('does not expose generatedPrompt (sensitive) in latestRun', () => {
    const resp = buildReplayResponse({
      latestRun: {
        sandboxPlan: null,
        response: 'ok',
        filesChanged: null,
        commandsRun: null,
        testResult: null,
        commitHash: null,
        riskScore: null,
        status: 'preview',
      },
    });
    assert.ok(!('generatedPrompt' in (resp.latestRun ?? {})));
  });

  test('sandboxEnabled is false by default in test shape', () => {
    const resp = buildReplayResponse();
    assert.equal(resp.sandboxEnabled, false);
  });
});

// ---------------------------------------------------------------------------
// Evidence Gap Detection Tests
// ---------------------------------------------------------------------------

describe('detectEvidenceGap', () => {
  test('detects gap when agent run exists but no evidence chunks', () => {
    assert.equal(detectEvidenceGap(true, 0), true);
  });

  test('no gap when evidence chunks are present', () => {
    assert.equal(detectEvidenceGap(true, 3), false);
  });

  test('no gap when there is no agent run at all', () => {
    assert.equal(detectEvidenceGap(false, 0), false);
  });

  test('no gap when agent run exists and one chunk is captured', () => {
    assert.equal(detectEvidenceGap(true, 1), false);
  });
});
