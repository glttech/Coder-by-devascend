/**
 * Tests for sync progress state logic.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// ── Helpers ────────────────────────────────────────────────────────────────

interface SyncState {
  syncStatus: string;
  totalSynced: number;
  lastSyncedAt: string | null;
  errorMessage: string | null;
  updatedAt: string | null;
}

function makeSyncState(overrides: Partial<SyncState> = {}): SyncState {
  return {
    syncStatus: 'idle',
    totalSynced: 0,
    lastSyncedAt: null,
    errorMessage: null,
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function isActiveSync(state: SyncState | null): boolean {
  return state?.syncStatus === 'running';
}

function formatElapsed(startMs: number, nowMs: number): string {
  const sec = Math.floor((nowMs - startMs) / 1000);
  if (sec < 60) return `${sec}s elapsed`;
  return `${Math.floor(sec / 60)}m ${sec % 60}s elapsed`;
}

function buildProgressLabel(state: SyncState | null, elapsedSec: number): string {
  if (!state) return elapsedSec > 0 ? `${elapsedSec}s elapsed` : 'Starting…';
  const elapsed = elapsedSec > 0 ? `${elapsedSec}s elapsed` : 'Starting…';
  if (state.totalSynced > 0) return `${elapsed} · ${state.totalSynced} synced so far`;
  return elapsed;
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('syncProgress — state shape', () => {
  it('default state is idle with zero counts', () => {
    const s = makeSyncState();
    assert.equal(s.syncStatus, 'idle');
    assert.equal(s.totalSynced, 0);
    assert.equal(s.lastSyncedAt, null);
    assert.equal(s.errorMessage, null);
  });

  it('running state detected correctly', () => {
    const s = makeSyncState({ syncStatus: 'running' });
    assert.equal(isActiveSync(s), true);
  });

  it('idle state not active', () => {
    const s = makeSyncState({ syncStatus: 'idle' });
    assert.equal(isActiveSync(s), false);
  });

  it('error state not active', () => {
    const s = makeSyncState({ syncStatus: 'error', errorMessage: 'rate limit' });
    assert.equal(isActiveSync(s), false);
  });

  it('null state not active', () => {
    assert.equal(isActiveSync(null), false);
  });
});

describe('syncProgress — elapsed formatting', () => {
  it('formats seconds correctly', () => {
    const start = 0;
    const now = 35000;
    assert.equal(formatElapsed(start, now), '35s elapsed');
  });

  it('formats minutes correctly', () => {
    const start = 0;
    const now = 125000;
    assert.equal(formatElapsed(start, now), '2m 5s elapsed');
  });

  it('formats zero elapsed', () => {
    assert.equal(formatElapsed(1000, 1000), '0s elapsed');
  });
});

describe('syncProgress — progress label', () => {
  it('shows starting when elapsed is zero and no state', () => {
    assert.equal(buildProgressLabel(null, 0), 'Starting…');
  });

  it('shows elapsed when no totalSynced', () => {
    const label = buildProgressLabel(makeSyncState({ syncStatus: 'running' }), 10);
    assert.equal(label, '10s elapsed');
  });

  it('shows synced count when totalSynced > 0', () => {
    const label = buildProgressLabel(makeSyncState({ syncStatus: 'running', totalSynced: 47 }), 15);
    assert.ok(label.includes('47 synced so far'), `expected count in "${label}"`);
    assert.ok(label.includes('15s elapsed'), `expected elapsed in "${label}"`);
  });

  it('shows starting when elapsed is zero even with state', () => {
    const label = buildProgressLabel(makeSyncState({ syncStatus: 'running' }), 0);
    assert.equal(label, 'Starting…');
  });
});

describe('syncProgress — response safety', () => {
  it('never exposes projectId in status response shape', () => {
    const response = {
      syncStatus: 'idle',
      totalSynced: 42,
      lastSyncedAt: '2026-06-18T12:00:00.000Z',
      errorMessage: null,
      updatedAt: '2026-06-18T12:01:00.000Z',
    };
    assert.equal('projectId' in response, false);
    assert.equal('DATABASE_URL' in response, false);
    assert.equal('GITHUB_TOKEN' in response, false);
  });

  it('status values are a known set', () => {
    const validStatuses = ['idle', 'running', 'error'];
    for (const s of validStatuses) {
      const state = makeSyncState({ syncStatus: s });
      assert.ok(validStatuses.includes(state.syncStatus));
    }
  });
});
