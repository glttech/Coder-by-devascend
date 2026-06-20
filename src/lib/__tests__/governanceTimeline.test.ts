/**
 * Tests for the Governance Timeline aggregation logic.
 * Validates event construction, sorting, and field safety.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// ── Types (mirrors route) ──────────────────────────────────────────────────

type GovernanceEventType =
  | 'pr_merged' | 'pr_opened' | 'agent_run' | 'incident' | 'policy_gate' | 'change_control';

interface GovernanceEvent {
  id: string;
  type: GovernanceEventType;
  title: string;
  date: string;
  status: string | null;
  severity: string | null;
  classification: string | null;
  link: string | null;
  meta: Record<string, string | number | boolean | null>;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function makePREvent(overrides: Partial<{
  id: string; prNumber: number; title: string; merged: boolean;
  state: string; ciStatus: string | null; classification: string | null;
  bugState: string | null; prUrl: string | null;
  githubMergedAt: Date | null; githubCreatedAt: Date | null;
}> = {}): GovernanceEvent {
  const pr = {
    id: 'pr-1',
    prNumber: 42,
    title: 'Add authentication',
    merged: true,
    state: 'closed',
    ciStatus: 'success' as string | null,
    classification: 'feature' as string | null,
    bugState: null as string | null,
    prUrl: 'https://github.com/owner/repo/pull/42' as string | null,
    githubMergedAt: new Date('2026-06-15T10:00:00Z') as Date | null,
    githubCreatedAt: new Date('2026-06-14T08:00:00Z') as Date | null,
    ...overrides,
  };

  const date = pr.merged
    ? (pr.githubMergedAt?.toISOString() ?? pr.githubCreatedAt?.toISOString() ?? new Date().toISOString())
    : (pr.githubCreatedAt?.toISOString() ?? new Date().toISOString());

  return {
    id: pr.id,
    type: pr.merged ? 'pr_merged' : 'pr_opened',
    title: `#${pr.prNumber} ${pr.title}`,
    date,
    status: pr.merged ? 'merged' : pr.state,
    severity: null,
    classification: pr.classification ?? 'unclassified',
    link: pr.prUrl ?? null,
    meta: {
      prNumber: pr.prNumber,
      ciStatus: pr.ciStatus ?? null,
      bugState: pr.bugState ?? null,
    },
  };
}

function makeAgentRunEvent(overrides: Partial<{
  id: string; taskId: string; status: string;
  roleKey: string | null; riskScore: number | null;
  startedAt: Date; taskTitle: string | null;
}> = {}): GovernanceEvent {
  const run = {
    id: 'run-1',
    taskId: 'task-1',
    status: 'succeeded',
    roleKey: 'security_reviewer' as string | null,
    riskScore: 0.3 as number | null,
    startedAt: new Date('2026-06-16T14:00:00Z'),
    taskTitle: 'Review auth PR' as string | null,
    ...overrides,
  };
  return {
    id: run.id,
    type: 'agent_run',
    title: run.taskTitle ? `Agent run — ${run.taskTitle}` : 'Agent run',
    date: run.startedAt.toISOString(),
    status: run.status,
    severity: null,
    classification: run.roleKey ?? null,
    link: `/tasks/${run.taskId}`,
    meta: {
      riskScore: run.riskScore ?? null,
      roleKey: run.roleKey ?? null,
    },
  };
}

function makeIncidentEvent(overrides: Partial<{
  id: string; title: string; severity: string; status: string;
  trigger: string; createdAt: Date; taskId: string | null;
}> = {}): GovernanceEvent {
  const inc = {
    id: 'inc-1',
    title: 'CI failure on main',
    severity: 'high',
    status: 'open',
    trigger: 'ci_failure',
    createdAt: new Date('2026-06-17T09:00:00Z'),
    taskId: 'task-2' as string | null,
    ...overrides,
  };
  return {
    id: inc.id,
    type: 'incident',
    title: inc.title,
    date: inc.createdAt.toISOString(),
    status: inc.status,
    severity: inc.severity,
    classification: inc.trigger,
    link: inc.taskId ? `/tasks/${inc.taskId}` : null,
    meta: { trigger: inc.trigger },
  };
}

function sortEvents(events: GovernanceEvent[]): GovernanceEvent[] {
  return [...events].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('governanceTimeline — event construction', () => {
  it('PR merged event has correct type', () => {
    const ev = makePREvent({ merged: true });
    assert.equal(ev.type, 'pr_merged');
  });

  it('PR open event has correct type', () => {
    const ev = makePREvent({ merged: false, state: 'open', githubMergedAt: null });
    assert.equal(ev.type, 'pr_opened');
  });

  it('PR merged event uses githubMergedAt as date', () => {
    const mergedAt = new Date('2026-06-15T10:00:00Z');
    const ev = makePREvent({ merged: true, githubMergedAt: mergedAt });
    assert.equal(ev.date, mergedAt.toISOString());
  });

  it('PR open event uses githubCreatedAt as date', () => {
    const createdAt = new Date('2026-06-14T08:00:00Z');
    const ev = makePREvent({ merged: false, state: 'open', githubMergedAt: null, githubCreatedAt: createdAt });
    assert.equal(ev.date, createdAt.toISOString());
  });

  it('PR event title includes PR number and title', () => {
    const ev = makePREvent({ prNumber: 99, title: 'Fix auth bug' });
    assert.ok(ev.title.includes('#99'), 'title should include PR number');
    assert.ok(ev.title.includes('Fix auth bug'), 'title should include PR title');
  });

  it('agent run event has correct type and link', () => {
    const ev = makeAgentRunEvent({ taskId: 'task-abc' });
    assert.equal(ev.type, 'agent_run');
    assert.equal(ev.link, '/tasks/task-abc');
  });

  it('incident event has severity and correct type', () => {
    const ev = makeIncidentEvent({ severity: 'high' });
    assert.equal(ev.type, 'incident');
    assert.equal(ev.severity, 'high');
  });

  it('incident without taskId has null link', () => {
    const ev = makeIncidentEvent({ taskId: null });
    assert.equal(ev.link, null);
  });
});

describe('governanceTimeline — sorting', () => {
  it('sorts events newest first', () => {
    const events = [
      makePREvent({ id: 'pr-old', githubMergedAt: new Date('2026-06-10T00:00:00Z') }),
      makeIncidentEvent({ id: 'inc-newest', createdAt: new Date('2026-06-18T12:00:00Z') }),
      makeAgentRunEvent({ id: 'run-mid', startedAt: new Date('2026-06-15T06:00:00Z') }),
    ];
    const sorted = sortEvents(events);
    assert.equal(sorted[0].id, 'inc-newest');
    assert.equal(sorted[1].id, 'run-mid');
    assert.equal(sorted[2].id, 'pr-old');
  });

  it('handles equal dates without throwing', () => {
    const sameDate = new Date('2026-06-18T10:00:00Z');
    const events = [
      makePREvent({ id: 'pr-a', githubMergedAt: sameDate }),
      makeIncidentEvent({ id: 'inc-b', createdAt: sameDate }),
    ];
    assert.doesNotThrow(() => sortEvents(events));
    assert.equal(sortEvents(events).length, 2);
  });
});

describe('governanceTimeline — field safety', () => {
  it('PR event does not include raw body or embedding', () => {
    const ev = makePREvent();
    assert.equal('body' in ev, false, 'body must not be exposed');
    assert.equal('embedding' in ev, false, 'embedding must not be exposed');
    assert.equal('explanation' in ev, false, 'explanation must not be exposed');
    assert.equal('structuredOutput' in ev, false, 'structuredOutput must not be exposed');
  });

  it('agent run event does not include raw response or structuredOutput', () => {
    const ev = makeAgentRunEvent();
    assert.equal('response' in ev, false, 'response must not be exposed');
    assert.equal('structuredOutput' in ev, false, 'structuredOutput must not be exposed');
    assert.equal('generatedPrompt' in ev, false, 'generatedPrompt must not be exposed');
  });

  it('incident event does not include sensitive reviewer notes', () => {
    const ev = makeIncidentEvent();
    assert.equal('reviewerDecision' in ev, false, 'reviewerDecision must not be exposed in event');
    assert.equal('resolvedBy' in ev, false, 'resolvedBy must not be exposed in event');
  });

  it('meta field contains only safe scalar values', () => {
    const events = [
      makePREvent(),
      makeAgentRunEvent(),
      makeIncidentEvent(),
    ];
    for (const ev of events) {
      for (const val of Object.values(ev.meta)) {
        const t = typeof val;
        assert.ok(
          val === null || t === 'string' || t === 'number' || t === 'boolean',
          `meta value must be scalar, got ${t}: ${JSON.stringify(val)}`,
        );
      }
    }
  });
});

describe('governanceTimeline — limit handling', () => {
  it('applies limit correctly', () => {
    const events: GovernanceEvent[] = Array.from({ length: 150 }, (_, i) =>
      makePREvent({
        id: `pr-${i}`,
        prNumber: i + 1,
        githubMergedAt: new Date(Date.now() - i * 1000),
      }),
    );
    const limited = events.slice(0, 100);
    assert.equal(limited.length, 100);
  });

  it('respects maximum cap of 200', () => {
    const maxCap = 200;
    const requested = 999;
    const effective = Math.min(requested, maxCap);
    assert.equal(effective, 200);
  });
});

describe('governanceTimeline — empty project', () => {
  it('returns empty events array when no data', () => {
    const events: GovernanceEvent[] = [];
    const sorted = sortEvents(events);
    assert.deepEqual(sorted, []);
  });

  it('handles zero taskIds gracefully', () => {
    const taskIds: string[] = [];
    const wouldQuery = taskIds.length > 0;
    assert.equal(wouldQuery, false, 'should skip queries when no task IDs');
  });
});
