import prisma from '@/lib/prisma';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { RiskBadge, EnvBadge } from '@/components/ui/Badge';
import InstructionActions from '@/components/InstructionActions';

export const dynamic = 'force-dynamic';

export default async function PendingApprovalsPage() {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [pending, ciFailedPRs, mergeConflictPRs, stalePRs] = await Promise.all([
    prisma.instruction.findMany({
      where: { status: 'pending_approval' },
      orderBy: { createdAt: 'asc' },
      include: {
        task: { select: { id: true, title: true, riskLevel: true, environment: true } },
        auditLogs: {
          where: { event: 'instruction_submitted' },
          include: { user: { select: { name: true, email: true } } },
          take: 1,
        },
      },
    }),
    prisma.githubPR.findMany({
      where: { ciStatus: { in: ['failure'] } },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true, projectId: true, prNumber: true, title: true,
        ciStatus: true, state: true, updatedAt: true,
        project: { select: { name: true } },
      },
    }),
    prisma.githubPR.findMany({
      where: { state: 'open', ciStatus: 'error' },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true, projectId: true, prNumber: true, title: true,
        ciStatus: true, state: true, updatedAt: true,
        project: { select: { name: true } },
      },
    }),
    prisma.githubPR.findMany({
      where: { state: 'open', updatedAt: { lt: sevenDaysAgo } },
      orderBy: { updatedAt: 'asc' },
      select: {
        id: true, projectId: true, prNumber: true, title: true,
        ciStatus: true, state: true, updatedAt: true,
        project: { select: { name: true } },
      },
    }),
  ]);

  // Group instructions by task
  const taskMap = new Map<string, {
    task: { id: string; title: string; riskLevel: string; environment: string };
    instructions: typeof pending;
  }>();
  for (const instr of pending) {
    const key = instr.task.id;
    if (!taskMap.has(key)) taskMap.set(key, { task: instr.task, instructions: [] });
    taskMap.get(key)!.instructions.push(instr);
  }
  const groups = Array.from(taskMap.values());

  const totalActionItems = pending.length + ciFailedPRs.length + mergeConflictPRs.length + stalePRs.length;

  return (
    <div>
      <PageHeader
        title="Review Queue"
        subtitle="Action required — AI suggestions and PRs needing attention"
        badge={
          totalActionItems > 0 ? (
            <span className="badge badge-warning">{totalActionItems} waiting</span>
          ) : (
            <span className="badge badge-success">All clear</span>
          )
        }
      />

      {/* Section nav / summary */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <SectionPill label="Needs Review" count={pending.length} color="var(--amber)" />
        <SectionPill label="CI Failed" count={ciFailedPRs.length} color="var(--red)" />
        <SectionPill label="Merge Conflict" count={mergeConflictPRs.length} color="var(--orange, #f97316)" />
        <SectionPill label="Stale (7d+)" count={stalePRs.length} color="var(--purple)" />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>

        {/* 1. Needs Review */}
        <section>
          <SectionHeader title="Needs Review" count={pending.length} color="var(--amber)" />
          {pending.length === 0 ? (
            <EmptyState
              icon="🔍"
              title="Nothing to review"
              description="When an AI suggestion is submitted for a task, it will appear here for you to approve or block."
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {groups.map(({ task, instructions }) => (
                <div key={task.id}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid var(--border)',
                  }}>
                    <Link href={`/tasks/${task.id}`} style={{ fontWeight: 600, color: 'var(--blue)', fontSize: 14 }}>
                      {task.title}
                    </Link>
                    <RiskBadge level={task.riskLevel} />
                    <EnvBadge env={task.environment} />
                    <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)' }}>
                      {instructions.length} suggestion{instructions.length !== 1 ? 's' : ''} pending
                    </span>
                  </div>
                  <div className="table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>AI Suggestion</th>
                          <th>Submitted</th>
                          <th style={{ minWidth: 260 }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {instructions.map((instr) => (
                          <tr key={instr.id} style={{ verticalAlign: 'top' }}>
                            <td>
                              <div style={{ fontWeight: 500, color: 'var(--text)' }}>{instr.title}</div>
                              <span className="id-chip" style={{ marginTop: 3, display: 'inline-block' }}>
                                {instr.id.slice(0, 8)}
                              </span>
                              {instr.auditLogs[0]?.user && (
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                                  Submitted by {instr.auditLogs[0].user.name ?? instr.auditLogs[0].user.email}
                                </div>
                              )}
                            </td>
                            <td style={{ color: 'var(--text-muted)', fontSize: 12, paddingTop: 12 }}>
                              {instr.createdAt.toISOString().split('T')[0]}
                            </td>
                            <td>
                              <InstructionActions instructionId={instr.id} currentStatus={instr.status} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 2. CI Failed */}
        <section>
          <SectionHeader title="CI Failed" count={ciFailedPRs.length} color="var(--red)" />
          {ciFailedPRs.length === 0 ? (
            <EmptyState
              icon="✓"
              title="No CI failures"
              description="Pull requests with failed CI checks will appear here."
            />
          ) : (
            <PRTable prs={ciFailedPRs} statusLabel="CI failure" statusClass="badge-sev-high" />
          )}
        </section>

        {/* 3. Merge Conflict */}
        <section>
          <SectionHeader title="Merge Conflict" count={mergeConflictPRs.length} color="var(--orange, #f97316)" />
          {mergeConflictPRs.length === 0 ? (
            <EmptyState
              icon="✓"
              title="No merge conflicts"
              description="Pull requests with CI errors (potential merge conflicts) will appear here."
            />
          ) : (
            <PRTable prs={mergeConflictPRs} statusLabel="CI error" statusClass="badge-warning" />
          )}
        </section>

        {/* 4. Stale (7d+) */}
        <section>
          <SectionHeader title="Stale PRs (no activity 7+ days)" count={stalePRs.length} color="var(--purple)" />
          {stalePRs.length === 0 ? (
            <EmptyState
              icon="✓"
              title="No stale PRs"
              description="Open pull requests with no activity for 7+ days will appear here."
            />
          ) : (
            <PRTable prs={stalePRs} showLastActivity />
          )}
        </section>

      </div>
    </div>
  );
}

// ---- Sub-components ----

function SectionPill({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '4px 12px', borderRadius: 20,
      border: '1px solid var(--border)',
      fontSize: 13, color: 'var(--text-secondary)',
    }}>
      <span>{label}</span>
      <span style={{
        fontWeight: 700, fontSize: 13,
        color: count > 0 ? color : 'var(--text-muted)',
      }}>{count}</span>
    </div>
  );
}

function SectionHeader({ title, count, color }: { title: string; count: number; color: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      marginBottom: 12, paddingBottom: 10,
      borderBottom: '2px solid var(--border)',
    }}>
      <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>{title}</span>
      {count > 0 && (
        <span style={{
          background: color, color: '#fff',
          borderRadius: 99, padding: '1px 8px',
          fontSize: 12, fontWeight: 700,
        }}>{count}</span>
      )}
    </div>
  );
}

type PRRow = {
  id: string;
  projectId: string;
  prNumber: number;
  title: string;
  ciStatus: string | null;
  state: string;
  updatedAt: Date;
  project: { name: string };
};

function PRTable({
  prs,
  statusLabel,
  statusClass,
  showLastActivity,
}: {
  prs: PRRow[];
  statusLabel?: string;
  statusClass?: string;
  showLastActivity?: boolean;
}) {
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>PR</th>
            <th>Title</th>
            <th>Project</th>
            <th>Status</th>
            {showLastActivity && <th>Last Activity</th>}
          </tr>
        </thead>
        <tbody>
          {prs.map((pr) => (
            <tr key={pr.id}>
              <td>
                <Link
                  href={`/projects/${pr.projectId}/prs/${pr.id}`}
                  style={{ color: 'var(--blue)', fontFamily: 'monospace', fontSize: 12, fontWeight: 600 }}
                >
                  #{pr.prNumber}
                </Link>
              </td>
              <td style={{ maxWidth: 300 }}>
                <Link
                  href={`/projects/${pr.projectId}/prs/${pr.id}`}
                  style={{ color: 'var(--text)', fontSize: 13, fontWeight: 500 }}
                >
                  {pr.title.length > 70 ? pr.title.slice(0, 70) + '…' : pr.title}
                </Link>
              </td>
              <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                <Link href={`/projects/${pr.projectId}`} style={{ color: 'var(--text-secondary)' }}>
                  {pr.project.name}
                </Link>
              </td>
              <td>
                {statusLabel && statusClass ? (
                  <span className={`badge ${statusClass}`}>{statusLabel}</span>
                ) : (
                  <span className="badge badge-neutral">{pr.state}</span>
                )}
              </td>
              {showLastActivity && (
                <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {pr.updatedAt.toLocaleDateString()}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
