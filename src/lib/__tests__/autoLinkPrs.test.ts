/**
 * Tests for the PR auto-link scoring logic used in
 * GET /api/agent-runs/[id]/link-prs.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// ── Types ─────────────────────────────────────────────────────────────────────

interface PrCandidate {
  id: string;
  prNumber: number;
  title: string;
  state: string;
  merged: boolean;
  ciStatus: string | null;
  classification: string | null;
  sourceBranch: string | null;
  mergeSha: string | null;
  prUrl: string | null;
  githubCreatedAt: Date | null;
  githubMergedAt: Date | null;
}

interface ScoredPR extends PrCandidate {
  score: number;
  matchReason: string;
}

// ── Scoring helpers (extracted from route) ────────────────────────────────────

const WINDOW_MS = 24 * 60 * 60 * 1000;

function scorePr(
  pr: PrCandidate,
  commitHash: string | null,
  runCenter: Date,
  titleWords: Set<string>,
): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  if (commitHash && pr.mergeSha && pr.mergeSha === commitHash) {
    score += 10;
    reasons.push('commit SHA match');
  }

  const prTimestamp = pr.githubMergedAt ?? pr.githubCreatedAt;
  if (prTimestamp) {
    const diffMs = Math.abs(prTimestamp.getTime() - runCenter.getTime());
    if (diffMs < WINDOW_MS) {
      const pts = Math.round(5 * (1 - diffMs / WINDOW_MS));
      score += pts;
      reasons.push(`within 24h (${Math.round(diffMs / 3600000)}h apart)`);
    }
  }

  if (pr.sourceBranch && titleWords.size > 0) {
    const branchWords = pr.sourceBranch.toLowerCase().split(/[-_/]+/);
    const matches = branchWords.filter((w) => titleWords.has(w));
    if (matches.length > 0) {
      score += matches.length * 2;
      reasons.push(`branch keyword match (${matches.slice(0, 2).join(', ')})`);
    }
  }

  return { score, reasons };
}

function makeTitleWords(title: string): Set<string> {
  return new Set(
    title.toLowerCase().split(/[\W_]+/).filter((w) => w.length > 3),
  );
}

function makeCandidate(overrides: Partial<PrCandidate> = {}): PrCandidate {
  return {
    id: 'pr-1',
    prNumber: 42,
    title: 'feat: add login flow',
    state: 'open',
    merged: false,
    ciStatus: 'success',
    classification: 'feature',
    sourceBranch: 'feat/login-flow',
    mergeSha: null,
    prUrl: null,
    githubCreatedAt: null,
    githubMergedAt: null,
    ...overrides,
  };
}

// ── SHA match scoring ─────────────────────────────────────────────────────────

describe('autoLinkPrs — SHA match', () => {
  it('awards 10 points for exact SHA match', () => {
    const pr = makeCandidate({ mergeSha: 'abc123' });
    const { score } = scorePr(pr, 'abc123', new Date(), new Set());
    assert.equal(score, 10);
  });

  it('awards 0 points for SHA mismatch', () => {
    const pr = makeCandidate({ mergeSha: 'abc123' });
    const { score } = scorePr(pr, 'def456', new Date(), new Set());
    assert.equal(score, 0);
  });

  it('awards 0 points when commitHash is null', () => {
    const pr = makeCandidate({ mergeSha: 'abc123' });
    const { score } = scorePr(pr, null, new Date(), new Set());
    assert.equal(score, 0);
  });

  it('awards 0 points when mergeSha is null', () => {
    const pr = makeCandidate({ mergeSha: null });
    const { score } = scorePr(pr, 'abc123', new Date(), new Set());
    assert.equal(score, 0);
  });

  it('SHA match reason is recorded', () => {
    const pr = makeCandidate({ mergeSha: 'abc123' });
    const { reasons } = scorePr(pr, 'abc123', new Date(), new Set());
    assert.ok(reasons.some((r) => r.includes('commit SHA match')));
  });
});

// ── Time proximity scoring ────────────────────────────────────────────────────

describe('autoLinkPrs — time proximity', () => {
  const runCenter = new Date('2026-06-19T12:00:00Z');

  it('awards up to 5 points for very recent PR (same time)', () => {
    const pr = makeCandidate({ githubCreatedAt: runCenter });
    const { score } = scorePr(pr, null, runCenter, new Set());
    assert.equal(score, 5);
  });

  it('awards partial points for PR created 12h before run', () => {
    const twelvehBefore = new Date(runCenter.getTime() - 12 * 3600 * 1000);
    const pr = makeCandidate({ githubCreatedAt: twelvehBefore });
    const { score } = scorePr(pr, null, runCenter, new Set());
    assert.ok(score > 0 && score < 5, `expected 0 < score < 5, got ${score}`);
  });

  it('awards 0 points for PR more than 24h away', () => {
    const twoDaysAgo = new Date(runCenter.getTime() - 48 * 3600 * 1000);
    const pr = makeCandidate({ githubCreatedAt: twoDaysAgo });
    const { score } = scorePr(pr, null, runCenter, new Set());
    assert.equal(score, 0);
  });

  it('prefers githubMergedAt over githubCreatedAt', () => {
    const farAway = new Date(runCenter.getTime() - 48 * 3600 * 1000);
    const closeBy = new Date(runCenter.getTime() - 1 * 3600 * 1000);
    const pr = makeCandidate({ githubCreatedAt: farAway, githubMergedAt: closeBy });
    const { score } = scorePr(pr, null, runCenter, new Set());
    assert.ok(score > 0, 'should score based on mergedAt, not createdAt');
  });

  it('awards 0 when no timestamps on PR', () => {
    const pr = makeCandidate({ githubCreatedAt: null, githubMergedAt: null });
    const { score } = scorePr(pr, null, runCenter, new Set());
    assert.equal(score, 0);
  });
});

// ── Branch keyword scoring ────────────────────────────────────────────────────

describe('autoLinkPrs — branch keyword matching', () => {
  const runCenter = new Date();

  it('awards 2 points per matching keyword', () => {
    const pr = makeCandidate({ sourceBranch: 'feat/login-flow' });
    const words = makeTitleWords('Add login flow to settings page');
    const { score } = scorePr(pr, null, runCenter, words);
    // 'login' and 'flow' both match → 4 points
    assert.equal(score, 4);
  });

  it('only counts words longer than 3 chars from title', () => {
    const words = makeTitleWords('Fix bug in app');
    // 'fix', 'bug', 'app' are all 3 chars or fewer → should be empty
    assert.equal(words.size, 0);
  });

  it('awards 0 when branch is null', () => {
    const pr = makeCandidate({ sourceBranch: null });
    const words = makeTitleWords('Add login flow to dashboard');
    const { score } = scorePr(pr, null, runCenter, words);
    assert.equal(score, 0);
  });

  it('records keyword match reason', () => {
    const pr = makeCandidate({ sourceBranch: 'feat/authentication-login' });
    const words = makeTitleWords('Add authentication to login page');
    const { reasons } = scorePr(pr, null, runCenter, words);
    assert.ok(reasons.some((r) => r.includes('branch keyword match')));
  });
});

// ── Combined scoring ──────────────────────────────────────────────────────────

describe('autoLinkPrs — combined scoring', () => {
  const runCenter = new Date('2026-06-19T10:00:00Z');
  const recentDate = new Date(runCenter.getTime() - 30 * 60 * 1000); // 30m before

  it('SHA match dominates — returns highest score for exact SHA', () => {
    const prSha = makeCandidate({ id: 'sha', mergeSha: 'abc', githubCreatedAt: recentDate });
    const prRecent = makeCandidate({ id: 'recent', mergeSha: null, githubCreatedAt: recentDate });

    const titleWords = new Set<string>();
    const { score: shaScore } = scorePr(prSha, 'abc', runCenter, titleWords);
    const { score: recentScore } = scorePr(prRecent, 'abc', runCenter, titleWords);

    assert.ok(shaScore > recentScore, 'SHA match should outscore time-only match');
  });

  it('PR with SHA + branch keywords + recency gets maximum score', () => {
    const pr = makeCandidate({
      mergeSha: 'xyz',
      sourceBranch: 'feat/payments-flow',
      githubCreatedAt: runCenter,
    });
    const words = makeTitleWords('Add payments flow to checkout');
    const { score } = scorePr(pr, 'xyz', runCenter, words);
    // 10 (SHA) + 5 (time, exact) + 2 * 2 (payments, flow) = 19
    assert.ok(score >= 15, `expected score >= 15, got ${score}`);
  });

  it('unrelated PR scores 0', () => {
    const pr = makeCandidate({
      mergeSha: null,
      sourceBranch: 'chore/cleanup',
      githubCreatedAt: new Date(runCenter.getTime() - 72 * 3600 * 1000),
    });
    const words = makeTitleWords('Add authentication system');
    const { score } = scorePr(pr, 'other-sha', runCenter, words);
    assert.equal(score, 0);
  });
});

// ── makeTitleWords ────────────────────────────────────────────────────────────

describe('autoLinkPrs — makeTitleWords', () => {
  it('splits on non-word characters', () => {
    const words = makeTitleWords('feat: add-login_flow');
    assert.ok(words.has('login'));
    assert.ok(words.has('flow'));
  });

  it('lowercases words', () => {
    const words = makeTitleWords('Add LoginFlow Component');
    assert.ok(words.has('loginflow') || words.has('login'));
  });

  it('excludes words of 3 chars or fewer', () => {
    const words = makeTitleWords('fix bug in app');
    assert.equal(words.size, 0);
  });

  it('returns empty set for empty title', () => {
    const words = makeTitleWords('');
    assert.equal(words.size, 0);
  });
});
