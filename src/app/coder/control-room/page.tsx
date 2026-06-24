import prisma from '@/lib/prisma';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';

export const dynamic = 'force-dynamic';

// ── Badges ──────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string }> = {
    pending:   { bg: 'rgba(100,116,139,0.1)', color: '#64748b' },
    running:   { bg: 'rgba(59,130,246,0.1)',  color: '#2563eb' },
    completed: { bg: 'rgba(34,197,94,0.1)',   color: '#16a34a' },
    failed:    { bg: 'rgba(239,68,68,0.1)',   color: '#dc2626' },
    cancelled: { bg: 'rgba(156,163,175,0.1)', color: '#6b7280' },
    open:      { bg: 'rgba(34,197,94,0.1)',   color: '#16a34a' },
    closed:    { bg: 'rgba(156,163,175,0.1)', color: '#6b7280' },
  };
  const s = map[status] ?? map.pending;
  return (
    <span
      style={{
        background: s.bg,
        color: s.color,
        border: `1px solid ${s.color}4d`,
        padding: '2px 8px',
        borderRadius: 4,
        fontSize: 11,
        fontWeight: 600,
      }}
    >
      {status}
    </span>
  );
}

function RiskBadge({ risk }: { risk: string }) {
  const colors: Record<string, string> = { low: '#16a34a', medium: '#d97706', high: '#dc2626' };
  const color = colors[risk] ?? '#64748b';
  return (
    <span
      style={{
        color,
        background: `${color}1a`,
        border: `1px solid ${color}4d`,
        padding: '2px 8px',
        borderRadius: 4,
        fontSize: 11,
        fontWeight: 600,
      }}
    >
      {risk}
    </span>
  );
}

function PrStateBadge({ state, merged }: { state: string; merged: boolean }) {
  if (merged)
    return (
      <span style={{ color: '#7c3aed', fontSize: 11, fontWeight: 600, background: 'rgba(124,58,237,0.1)', padding: '2px 8px', borderRadius: 4, border: '1px solid rgba(124,58,237,0.3)' }}>
        merged
      </span>
    );
  return <StatusBadge status={state} />;
}

function KindTag({ kind }: { kind: 'task' | 'session' | 'pr' }) {
  const map = {
    task:    { label: 'Task',    color: '#7c3aed', bg: 'rgba(124,58,237,0.08)' },
    session: { label: 'Session', color: '#2563eb', bg: 'rgba(59,130,246,0.08)' },
    pr:      { label: 'PR',      color: '#0891b2', bg: 'rgba(8,145,178,0.08)'  },
  };
  const s = map[kind];
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '0.05em',
        color: s.color,
        background: s.bg,
        padding: '2px 6px',
        borderRadius: 3,
        border: `1px solid ${s.color}33`,
        flexShrink: 0,
      }}
    >
      {s.label}
    </span>
  );
}

function relativeTime(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// ── Types ────────────────────────────────────────────────────────────────────

type TaskRow = {
  id: string;
  title: string;
  status: string;
  riskLevel: string;
  updatedAt: Date;
  project: { id: string; name: string } | null;
  approval: { approved: boolean | null } | null;
};

type SessionRow = {
  id: string;
  command: string;
  status: string;
  exitCode: number | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  task: { id: string; title: string } | null;
  repository: { id: string; fullName: string } | null;
};

type PrRow = {
  id: string;
  prNumber: number;
  title: string;
  state: string;
  merged: boolean;
  author: string | null;
  ciStatus: string | null;
  prUrl: string | null;
  sourceBranch: string | null;
  githubUpdatedAt: Date | null;
  repository: { id: string; fullName: string } | null;
  task: { id: string; title: string } | null;
};

type Entry =
  | { kind: 'task';    ts: Date; data: TaskRow }
  | { kind: 'session'; ts: Date; data: SessionRow }
  | { kind: 'pr';      ts: Date; data: PrRow };

// ── Entry cards ───────────────────────────────────────────────────────────────

function TaskCard({ data, ts }: { data: TaskRow; ts: Date }) {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <KindTag kind="task" />
          <Link href={`/tasks/${data.id}`} style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
            {data.title}
          </Link>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <StatusBadge status={data.status} />
          <RiskBadge risk={data.riskLevel} />
          {data.approval && (
            <span style={{ fontSize: 11, color: data.approval.approved === true ? '#16a34a' : data.approval.approved === false ? '#dc2626' : '#d97706' }}>
              {data.approval.approved === true ? '✓ approved' : data.approval.approved === false ? '✗ rejected' : '⏳ pending approval'}
            </span>
          )}
          {data.project && (
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{data.project.name}</span>
          )}
        </div>
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0, paddingTop: 2 }}>
        {relativeTime(ts.toISOString())}
      </div>
    </div>
  );
}

function SessionCard({ data, ts }: { data: SessionRow; ts: Date }) {
  const durationSecs =
    data.startedAt && data.completedAt
      ? Math.round((data.completedAt.getTime() - data.startedAt.getTime()) / 1000)
      : null;

  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <KindTag kind="session" />
          <Link href={`/coder/sessions/${data.id}`} style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>
            <code style={{ fontSize: 12 }}>
              {data.command.length > 70 ? data.command.slice(0, 70) + '…' : data.command}
            </code>
          </Link>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <StatusBadge status={data.status} />
          {data.exitCode !== null && (
            <code style={{ fontSize: 11, color: data.exitCode === 0 ? '#16a34a' : '#dc2626' }}>
              exit {data.exitCode}
            </code>
          )}
          {durationSecs !== null && (
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {durationSecs < 60 ? `${durationSecs}s` : `${Math.floor(durationSecs / 60)}m ${durationSecs % 60}s`}
            </span>
          )}
          {data.repository && (
            <Link href={`/coder/repositories/${data.repository.id}`} style={{ fontSize: 11, color: 'var(--blue)' }}>
              {data.repository.fullName}
            </Link>
          )}
          {data.task && (
            <Link href={`/tasks/${data.task.id}`} style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {data.task.title.length > 30 ? data.task.title.slice(0, 30) + '…' : data.task.title}
            </Link>
          )}
        </div>
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0, paddingTop: 2 }}>
        {relativeTime(ts.toISOString())}
      </div>
    </div>
  );
}

function PrCard({ data, ts }: { data: PrRow; ts: Date }) {
  const ciColor = data.ciStatus === 'success' ? '#16a34a' : data.ciStatus === 'failure' ? '#dc2626' : '#64748b';

  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <KindTag kind="pr" />
          {data.prUrl ? (
            <a href={data.prUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
              #{data.prNumber} {data.title}
            </a>
          ) : (
            <span style={{ fontSize: 14, fontWeight: 600 }}>#{data.prNumber} {data.title}</span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <PrStateBadge state={data.state} merged={data.merged} />
          {data.ciStatus && (
            <span style={{ fontSize: 11, color: ciColor, fontWeight: 600 }}>
              CI: {data.ciStatus}
            </span>
          )}
          {data.sourceBranch && (
            <code style={{ fontSize: 11, color: 'var(--text-muted)' }}>{data.sourceBranch}</code>
          )}
          {data.repository && (
            <Link href={`/coder/repositories/${data.repository.id}`} style={{ fontSize: 11, color: 'var(--blue)' }}>
              {data.repository.fullName}
            </Link>
          )}
          {data.author && (
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>by {data.author}</span>
          )}
          {data.task && (
            <Link href={`/tasks/${data.task.id}`} style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {data.task.title.length > 30 ? data.task.title.slice(0, 30) + '…' : data.task.title}
            </Link>
          )}
        </div>
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0, paddingTop: 2 }}>
        {relativeTime(ts.toISOString())}
      </div>
    </div>
  );
}

// ── Filter bar ────────────────────────────────────────────────────────────────

interface FilterBarProps {
  repos: { id: string; fullName: string }[];
  repoId?: string;
  status?: string;
}

function FilterBar({ repos, repoId, status }: FilterBarProps) {
  const statuses = ['pending', 'running', 'completed', 'failed', 'open', 'closed'];

  function buildHref(overrides: Record<string, string | undefined>) {
    const p = new URLSearchParams();
    if ((overrides.repoId ?? repoId) !== undefined) p.set('repoId', overrides.repoId ?? repoId!);
    if ((overrides.status ?? status) !== undefined) p.set('status', overrides.status ?? status!);
    const qs = p.toString();
    return `/coder/control-room${qs ? '?' + qs : ''}`;
  }

  return (
    <div
      style={{
        display: 'flex',
        gap: 12,
        flexWrap: 'wrap',
        alignItems: 'center',
        padding: '10px 14px',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        marginBottom: 20,
        fontSize: 13,
      }}
    >
      {/* Repository filter */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>REPO</span>
        <Link
          href={buildHref({ repoId: undefined })}
          style={{
            fontSize: 12,
            color: !repoId ? 'var(--text)' : 'var(--blue)',
            fontWeight: !repoId ? 700 : 400,
          }}
        >
          All
        </Link>
        {repos.map((r) => (
          <Link
            key={r.id}
            href={buildHref({ repoId: r.id })}
            style={{
              fontSize: 12,
              color: repoId === r.id ? 'var(--text)' : 'var(--blue)',
              fontWeight: repoId === r.id ? 700 : 400,
            }}
          >
            {r.fullName}
          </Link>
        ))}
      </div>

      <div style={{ width: 1, height: 14, background: 'var(--border)' }} />

      {/* Status filter */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>STATUS</span>
        <Link
          href={buildHref({ status: undefined })}
          style={{ fontSize: 12, color: !status ? 'var(--text)' : 'var(--blue)', fontWeight: !status ? 700 : 400 }}
        >
          All
        </Link>
        {statuses.map((s) => (
          <Link
            key={s}
            href={buildHref({ status: s })}
            style={{ fontSize: 12, color: status === s ? 'var(--text)' : 'var(--blue)', fontWeight: status === s ? 700 : 400 }}
          >
            {s}
          </Link>
        ))}
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

const PAGE_LIMIT = 50;

interface PageProps {
  searchParams: {
    repoId?: string;
    taskId?: string;
    status?: string;
    cursor?: string;
  };
}

export default async function ControlRoomPage({ searchParams }: PageProps) {
  const { repoId, taskId, status, cursor } = searchParams;
  const cursorDate = cursor ? new Date(cursor) : undefined;

  const [tasks, sessions, prs, repos] = await Promise.all([
    prisma.task.findMany({
      where: {
        ...(taskId ? { id: taskId } : {}),
        ...(status && ['pending', 'running', 'completed', 'failed'].includes(status) ? { status } : {}),
        ...(cursorDate ? { updatedAt: { lt: cursorDate } } : {}),
      },
      orderBy: { updatedAt: 'desc' },
      take: PAGE_LIMIT,
      select: {
        id: true,
        title: true,
        status: true,
        riskLevel: true,
        updatedAt: true,
        project: { select: { id: true, name: true } },
        approval: { select: { approved: true } },
      },
    }),
    prisma.cliSession.findMany({
      where: {
        ...(taskId ? { taskId } : {}),
        ...(repoId ? { repoId } : {}),
        ...(status && ['pending', 'running', 'completed', 'failed', 'cancelled'].includes(status) ? { status } : {}),
        ...(cursorDate ? { createdAt: { lt: cursorDate } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: PAGE_LIMIT,
      select: {
        id: true,
        command: true,
        status: true,
        exitCode: true,
        startedAt: true,
        completedAt: true,
        createdAt: true,
        task: { select: { id: true, title: true } },
        repository: { select: { id: true, fullName: true } },
      },
    }),
    prisma.repositoryPR.findMany({
      where: {
        ...(repoId ? { repoId } : {}),
        ...(taskId ? { taskId } : {}),
        ...(status && ['open', 'closed'].includes(status) ? { state: status } : {}),
        ...(cursorDate ? { githubUpdatedAt: { lt: cursorDate } } : {}),
      },
      orderBy: { githubUpdatedAt: 'desc' },
      take: PAGE_LIMIT,
      select: {
        id: true,
        prNumber: true,
        title: true,
        state: true,
        merged: true,
        author: true,
        ciStatus: true,
        prUrl: true,
        sourceBranch: true,
        githubUpdatedAt: true,
        syncedAt: true,
        repository: { select: { id: true, fullName: true } },
        task: { select: { id: true, title: true } },
      },
    }),
    prisma.repository.findMany({
      where: { orgId: 'org_default', enabled: true },
      select: { id: true, fullName: true },
      orderBy: { fullName: 'asc' },
    }),
  ]);

  const entries: Entry[] = [
    ...tasks.map((t) => ({
      kind: 'task' as const,
      ts: t.updatedAt,
      data: t as TaskRow,
    })),
    ...sessions.map((s) => ({
      kind: 'session' as const,
      ts: s.createdAt,
      data: s as SessionRow,
    })),
    ...prs.map((p) => ({
      kind: 'pr' as const,
      ts: p.githubUpdatedAt ?? p.syncedAt,
      data: p as PrRow,
    })),
  ];

  entries.sort((a, b) => b.ts.getTime() - a.ts.getTime());
  const page = entries.slice(0, PAGE_LIMIT);
  const nextCursor = page.length === PAGE_LIMIT ? page[page.length - 1].ts.toISOString() : null;

  const total = tasks.length + sessions.length + prs.length;
  const subtitle = cursor
    ? `${page.length} events shown`
    : `${total} events across tasks, sessions, and PRs`;

  const filterParams: Record<string, string> = {};
  if (repoId) filterParams.repoId = repoId;
  if (status) filterParams.status = status;

  return (
    <div>
      <PageHeader title="Control Room" subtitle={subtitle} />

      <FilterBar repos={repos} repoId={repoId} status={status} />

      {page.length === 0 ? (
        <EmptyState
          icon="◎"
          title="No events yet."
          description="Tasks, CLI sessions, and GitHub PRs will appear here as work progresses."
        />
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {page.map((entry, i) => (
              <div key={`${entry.kind}-${i}`} className="feed-card">
                {entry.kind === 'task' && <TaskCard data={entry.data} ts={entry.ts} />}
                {entry.kind === 'session' && <SessionCard data={entry.data} ts={entry.ts} />}
                {entry.kind === 'pr' && <PrCard data={entry.data} ts={entry.ts} />}
              </div>
            ))}
          </div>

          {nextCursor && (
            <div style={{ marginTop: 16, textAlign: 'center' }}>
              <Link
                href={`/coder/control-room?cursor=${encodeURIComponent(nextCursor)}${repoId ? `&repoId=${repoId}` : ''}${status ? `&status=${status}` : ''}`}
                className="btn btn-ghost"
              >
                Next page →
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}
