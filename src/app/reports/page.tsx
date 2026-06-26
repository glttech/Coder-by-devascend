import prisma from '@/lib/prisma';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui/PageHeader';
import { MetricCard } from '@/components/ui/MetricCard';
import { getCurrentUser } from '@/lib/session';
import { requireRole } from '@/lib/rbac';
import { analyzePrImportance } from '@/lib/prIntelligence';
import { evaluatePrPolicy, VERDICT_META, APPROVER_LABEL, summarizePolicyVerdicts, type PrPolicyResult } from '@/lib/prPolicyEngine';
import {
  generateReport,
  REPORT_TYPE_META,
  type ReportType,
  type ReportInput,
  type ReportPR,
  type ReportProject,
  type ReportAgentRun,
} from '@/lib/reportsEngine';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: { type?: string; repo?: string };
}

const REPORT_TYPES: ReportType[] = [
  'weekly_founder_brief',
  'engineering_risk',
  'pr_governance',
  'repo_health',
  'merge_readiness',
  'agent_quality',
];

function normaliseReportType(raw?: string): ReportType {
  if (REPORT_TYPES.includes(raw as ReportType)) return raw as ReportType;
  return 'weekly_founder_brief';
}

export default async function ReportsPage({ searchParams }: PageProps) {
  const user = await getCurrentUser();
  const authResult = requireRole(user, 'any');
  if (!authResult.ok) redirect('/login');

  const reportType = normaliseReportType(searchParams.type);
  const repoFilter = searchParams.repo ?? '';

  // ── Load all data ─────────────────────────────────────────────────────────
  const [projects, rawPRs, agentRuns, totalTasks, openIncidents] = await Promise.all([
    prisma.project.findMany({
      select: { id: true, name: true, repoOwner: true, repoName: true },
      orderBy: { name: 'asc' },
    }),
    prisma.githubPR.findMany({
      where: { ...(repoFilter ? { projectId: repoFilter } : {}) },
      orderBy: { githubUpdatedAt: 'desc' },
      take: 500,
      select: {
        id: true,
        projectId: true,
        prNumber: true,
        title: true,
        body: true,
        state: true,
        merged: true,
        ciStatus: true,
        classification: true,
        labels: true,
        filesChanged: true,
        filesChangedCount: true,
        prUrl: true,
        githubUpdatedAt: true,
        githubMergedAt: true,
        importedAt: true,
      },
    }),
    prisma.agentRun.findMany({
      orderBy: { startedAt: 'desc' },
      take: 50,
      select: {
        id: true,
        status: true,
        riskScore: true,
        startedAt: true,
        endedAt: true,
        modelUsed: true,
        task: { select: { title: true, project: { select: { name: true } } } },
      },
    }),
    prisma.task.count({ where: { status: { not: 'done' } } }),
    prisma.incident.count({ where: { status: { in: ['open', 'investigating'] } } }),
  ]);

  const projectMap = new Map(projects.map((p) => [p.id, p]));

  // ── Build ReportPR list ───────────────────────────────────────────────────
  const reportPRs: ReportPR[] = rawPRs.map((pr) => {
    const project = projectMap.get(pr.projectId);
    const intel = analyzePrImportance(pr);
    const policy = evaluatePrPolicy({ ...pr, _intel: intel });
    const repoLabel =
      project?.repoOwner && project?.repoName
        ? `${project.repoOwner}/${project.repoName}`
        : project?.name ?? '—';
    return {
      ...pr,
      intel,
      policy,
      projectName: project?.name ?? '—',
      repoLabel,
      githubUpdatedAt: pr.githubUpdatedAt,
      githubMergedAt: pr.githubMergedAt,
    };
  });

  // ── Build ReportProject list ──────────────────────────────────────────────
  const reportProjects: ReportProject[] = projects.map((p) => {
    const pPRs = reportPRs.filter((pr) => pr.projectId === p.id && pr.state === 'open' && !pr.merged);
    return {
      id: p.id,
      name: p.name,
      repoOwner: p.repoOwner,
      repoName: p.repoName,
      openPRs: pPRs.length,
      blockedPRs: pPRs.filter((pr) => pr.intel.triage === 'blocked').length,
      needsReviewPRs: pPRs.filter((pr) => pr.intel.triage === 'needs_review').length,
      failedCIPRs: pPRs.filter((pr) => pr.ciStatus === 'failure').length,
      policyBlocked: pPRs.filter((pr) => pr.policy.verdict === 'blocked').length,
      policyReviewRequired: pPRs.filter((pr) => pr.policy.verdict === 'review_required').length,
      policyPass: pPRs.filter((pr) => pr.policy.verdict === 'pass').length,
    };
  });

  const reportAgentRuns: ReportAgentRun[] = agentRuns.map((r) => ({
    id: r.id,
    taskTitle: r.task?.title ?? '—',
    projectName: r.task?.project?.name ?? '—',
    status: r.status,
    riskScore: r.riskScore,
    startedAt: r.startedAt,
    endedAt: r.endedAt,
    modelUsed: r.modelUsed,
  }));

  const reportInput: ReportInput = {
    prs: reportPRs,
    projects: reportProjects,
    agentRuns: reportAgentRuns,
    totalTasks,
    openIncidents,
    repoFilter,
  };

  const report = generateReport(reportType, reportInput);
  const policyVerdicts = report.policyVerdicts;

  const openPRs = reportPRs.filter((p) => p.state === 'open' && !p.merged);
  const blockedPolicyPRs = openPRs.filter((p) => p.policy.verdict === 'blocked');
  const reviewRequiredPRs = openPRs.filter((p) => p.policy.verdict === 'review_required');
  const passPRs = openPRs.filter((p) => p.policy.verdict === 'pass');

  function typeHref(t: ReportType) {
    const params = new URLSearchParams();
    params.set('type', t);
    if (repoFilter) params.set('repo', repoFilter);
    return `/reports?${params.toString()}`;
  }

  function repoHref(repoId: string) {
    const params = new URLSearchParams();
    params.set('type', reportType);
    if (repoId) params.set('repo', repoId);
    return `/reports?${params.toString()}`;
  }

  const meta = REPORT_TYPE_META[reportType];

  return (
    <div>
      <PageHeader
        title="Founder / CTO Reports"
        subtitle="Live reports generated from repo, PR, policy, and session data"
        badge={<span className="badge badge-neutral">Live data</span>}
        actions={
          <Link href="/review" className="btn btn-ghost btn-sm">
            Review Center →
          </Link>
        }
      />

      {/* ── Top-line policy metrics ── */}
      <div className="section">
        <div className="metric-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', maxWidth: 720 }}>
          <MetricCard
            label="Policy Blocked"
            value={policyVerdicts.blocked}
            sub="cannot merge"
            accent={policyVerdicts.blocked > 0 ? 'red' : 'green'}
            href="/review?triage=blocked"
          />
          <MetricCard
            label="Review Required"
            value={policyVerdicts.review_required}
            sub="needs human sign-off"
            accent={policyVerdicts.review_required > 0 ? 'amber' : 'green'}
            href="/review?triage=needs_review"
          />
          <MetricCard
            label="Policy Pass"
            value={policyVerdicts.pass}
            sub="safe to merge"
            accent="green"
            href="/review"
          />
          <MetricCard
            label="Open PRs"
            value={openPRs.length}
            sub="across all repos"
            accent="blue"
            href="/review"
          />
        </div>
      </div>

      {/* ── Report type selector ── */}
      <div className="section" style={{ paddingTop: 0, paddingBottom: 8 }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', minWidth: 56 }}>
            Report
          </span>
          {REPORT_TYPES.map((t) => {
            const m = REPORT_TYPE_META[t];
            const isActive = reportType === t;
            return (
              <Link
                key={t}
                href={typeHref(t)}
                className={`badge ${isActive ? 'badge-active' : 'badge-neutral'}`}
                style={{ cursor: 'pointer', textDecoration: 'none', fontSize: 11 }}
                title={m.description}
              >
                {m.icon} {m.label}
              </Link>
            );
          })}
        </div>

        {/* Repo filter */}
        {projects.length > 1 && (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', minWidth: 56 }}>
              Repo
            </span>
            <Link
              href={repoHref('')}
              className={`badge ${!repoFilter ? 'badge-active' : 'badge-neutral'}`}
              style={{ cursor: 'pointer', textDecoration: 'none', fontSize: 11 }}
            >
              All repos
            </Link>
            {projects.map((p) => {
              const label = p.repoOwner && p.repoName ? `${p.repoOwner}/${p.repoName}` : p.name;
              return (
                <Link
                  key={p.id}
                  href={repoHref(p.id)}
                  className={`badge ${repoFilter === p.id ? 'badge-active' : 'badge-neutral'}`}
                  style={{ cursor: 'pointer', textDecoration: 'none', fontSize: 11 }}
                  title={label}
                >
                  {label.length > 28 ? label.slice(0, 28) + '…' : label}
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Report header ── */}
      <div className="section" style={{ paddingTop: 0 }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '20px 24px', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                {meta.icon} {meta.label}
              </div>
              <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{meta.description}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                Generated {report.generatedAt.toLocaleString()}
                {repoFilter && ` · Repo: ${projects.find((p) => p.id === repoFilter)?.name ?? repoFilter}`}
              </div>
            </div>
            <MarkdownExportButton content={report.markdownContent} filename={`${reportType}-${report.generatedAt.toISOString().slice(0, 10)}.md`} title={report.title} />
          </div>
        </div>

        {/* Executive summary */}
        <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '14px 18px', marginBottom: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
            Executive Summary
          </div>
          <p style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6, margin: 0 }}>
            {report.executiveSummary || 'No data available for this report.'}
          </p>
        </div>

        {/* Action list */}
        {report.founderActionList.length > 0 && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '14px 18px', marginBottom: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
              Your Action List
            </div>
            {report.founderActionList.map((action, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 8, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--blue)', minWidth: 20 }}>{i + 1}.</span>
                <span style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>{action}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Report-specific content ── */}
      {reportType === 'weekly_founder_brief' && (
        <WeeklyBriefContent prs={reportPRs} openPRs={openPRs} blockedPRs={blockedPolicyPRs} reviewPRs={reviewRequiredPRs} />
      )}
      {reportType === 'engineering_risk' && (
        <EngineeringRiskContent prs={openPRs} projects={reportProjects} />
      )}
      {reportType === 'pr_governance' && (
        <PrGovernanceContent prs={openPRs} policyVerdicts={policyVerdicts} />
      )}
      {reportType === 'repo_health' && (
        <RepoHealthContent projects={reportProjects} />
      )}
      {reportType === 'merge_readiness' && (
        <MergeReadinessContent prs={openPRs} />
      )}
      {reportType === 'agent_quality' && (
        <AgentQualityContent agentRuns={reportAgentRuns} totalTasks={totalTasks} />
      )}
    </div>
  );
}

// ── Markdown export button (client component) ─────────────────────────────────

function MarkdownExportButton({ content, filename, title }: { content: string; filename: string; title: string }) {
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <button
        onClick={undefined}
        data-md-content={encodeURIComponent(content)}
        data-md-filename={filename}
        className="btn btn-ghost btn-sm js-md-copy"
        style={{ fontSize: 11 }}
        title="Copy as Markdown"
      >
        Copy MD
      </button>
      <a
        href={`data:text/markdown;charset=utf-8,${encodeURIComponent(content)}`}
        download={filename}
        className="btn btn-ghost btn-sm"
        style={{ fontSize: 11, textDecoration: 'none' }}
        title={`Download ${title} as Markdown`}
      >
        ↓ Download
      </a>
    </div>
  );
}

// ── Weekly Founder Brief content ──────────────────────────────────────────────

type PrRow = { id: string; projectId: string; prNumber: number; title: string; ciStatus: string | null; prUrl: string | null; policy: PrPolicyResult; githubMergedAt: Date | null; projectName: string; repoLabel: string };

function WeeklyBriefContent({ prs, openPRs, blockedPRs, reviewPRs }: { prs: PrRow[]; openPRs: PrRow[]; blockedPRs: PrRow[]; reviewPRs: PrRow[] }) {
  const now = new Date();
  const mergedThisWeek = prs.filter(
    (p) => p.policy && p.githubMergedAt && now.getTime() - p.githubMergedAt.getTime() < 7 * 24 * 60 * 60 * 1000,
  );

  return (
    <>
      {/* Blocked PRs */}
      <div className="section">
        <div className="section-header">
          <span className="section-header-title" style={{ color: blockedPRs.length > 0 ? 'var(--red)' : undefined }}>
            ⛔ Blocked — Immediate Action Required
          </span>
          {blockedPRs.length > 0 && <span className="section-header-count">{blockedPRs.length}</span>}
          <Link href="/review?triage=blocked" className="section-header-link">Open in Review Center →</Link>
        </div>
        {blockedPRs.length === 0 ? (
          <div className="feed-card" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="status-dot status-dot--success" />
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>No blocked PRs — all clear.</span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {blockedPRs.slice(0, 8).map((pr) => (
              <PolicyPrCard key={pr.id} pr={pr} borderColor="var(--red)" dotClass="status-dot--failed" />
            ))}
          </div>
        )}
      </div>

      {/* Review Required */}
      <div className="section">
        <div className="section-header">
          <span className="section-header-title" style={{ color: reviewPRs.length > 0 ? 'var(--amber)' : undefined }}>
            ⚑ Review Required
          </span>
          {reviewPRs.length > 0 && <span className="section-header-count">{reviewPRs.length}</span>}
          <Link href="/review?triage=needs_review" className="section-header-link">View all →</Link>
        </div>
        {reviewPRs.length === 0 ? (
          <div className="feed-card" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="status-dot status-dot--success" />
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>No PRs require review.</span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {reviewPRs.slice(0, 6).map((pr) => (
              <PolicyPrCard key={pr.id} pr={pr} borderColor="var(--amber)" dotClass="status-dot--pending" compact />
            ))}
          </div>
        )}
      </div>

      {/* Merged this week */}
      {mergedThisWeek.length > 0 && (
        <div className="section">
          <div className="section-header">
            <span className="section-header-title">Merged This Week</span>
            <span className="section-header-count">{mergedThisWeek.length}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {mergedThisWeek.slice(0, 5).map((pr) => (
              <div key={pr.id} className="feed-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span className="status-dot status-dot--success" />
                  <Link href={`/projects/${pr.projectId}/prs/${pr.id}`} style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--blue)' }}>#{pr.prNumber}</Link>
                  <Link href={`/projects/${pr.projectId}/prs/${pr.id}`} style={{ fontSize: 13, color: 'var(--text)', flex: 1 }}>{pr.title.length > 64 ? pr.title.slice(0, 64) + '…' : pr.title}</Link>
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{pr.repoLabel}</span>
                  <span className="badge badge-success" style={{ fontSize: 10 }}>merged</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

// ── Engineering Risk content ───────────────────────────────────────────────────

function EngineeringRiskContent({ prs, projects }: { prs: PrRow[]; projects: ReportProject[] }) {
  const sorted = [...prs].sort((a, b) => b.policy.policyScore - a.policy.policyScore).slice(0, 10);
  const failedCI = prs.filter((p) => p.ciStatus === 'failure');

  return (
    <>
      <div className="section">
        <div className="section-header">
          <span className="section-header-title">Top Risky PRs (by policy score)</span>
        </div>
        {sorted.length === 0 ? (
          <EmptyState message="No open PRs with policy concerns." />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 56 }}>PR</th>
                  <th>Repo</th>
                  <th>Title</th>
                  <th style={{ width: 64 }}>Score</th>
                  <th style={{ width: 100 }}>Verdict</th>
                  <th style={{ width: 100 }}>Approver</th>
                  <th style={{ width: 70 }}>CI</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((pr) => {
                  const vm = VERDICT_META[pr.policy.verdict];
                  return (
                    <tr key={pr.id}>
                      <td><Link href={`/projects/${pr.projectId}/prs/${pr.id}`} style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--blue)' }}>#{pr.prNumber}</Link></td>
                      <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{pr.repoLabel.length > 24 ? pr.repoLabel.slice(0, 24) + '…' : pr.repoLabel}</td>
                      <td style={{ maxWidth: 260 }}>
                        <Link href={`/projects/${pr.projectId}/prs/${pr.id}`} style={{ fontSize: 13, color: 'var(--text)' }}>{pr.title.length > 52 ? pr.title.slice(0, 52) + '…' : pr.title}</Link>
                        {pr.policy.violatedPolicies[0] && (
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{pr.policy.violatedPolicies[0].ruleName}</div>
                        )}
                      </td>
                      <td style={{ fontWeight: 700, fontSize: 13, color: pr.policy.policyScore > 40 ? 'var(--red)' : pr.policy.policyScore > 15 ? 'var(--amber)' : 'var(--text)' }}>
                        {pr.policy.policyScore}
                      </td>
                      <td><span className={`badge ${vm.badge}`} style={{ fontSize: 10 }}>{vm.label}</span></td>
                      <td style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{APPROVER_LABEL[pr.policy.requiredApprover]}</td>
                      <td>{pr.ciStatus ? <span className={`badge ${pr.ciStatus === 'success' ? 'badge-success' : pr.ciStatus === 'failure' ? 'badge-sev-high' : 'badge-neutral'}`} style={{ fontSize: 10 }}>{pr.ciStatus}</span> : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {failedCI.length > 0 && (
        <div className="section">
          <div className="section-header">
            <span className="section-header-title" style={{ color: 'var(--red)' }}>Failed CI</span>
            <span className="section-header-count">{failedCI.length}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {failedCI.map((pr) => (
              <div key={pr.id} className="feed-card" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span className="status-dot status-dot--failed" />
                <Link href={`/projects/${pr.projectId}/prs/${pr.id}`} style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--blue)' }}>#{pr.prNumber}</Link>
                <Link href={`/projects/${pr.projectId}/prs/${pr.id}`} style={{ fontSize: 13, color: 'var(--text)', flex: 1 }}>{pr.title.length > 64 ? pr.title.slice(0, 64) + '…' : pr.title}</Link>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{pr.repoLabel}</span>
                <span className="badge badge-sev-high" style={{ fontSize: 10 }}>failure</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="section">
        <div className="section-header"><span className="section-header-title">Repo Risk Summary</span></div>
        <RepoHealthTable projects={projects} />
      </div>
    </>
  );
}

// ── PR Governance content ─────────────────────────────────────────────────────

function PrGovernanceContent({ prs, policyVerdicts }: { prs: PrRow[]; policyVerdicts: ReturnType<typeof summarizePolicyVerdicts> }) {
  const blocked = prs.filter((p) => p.policy.verdict === 'blocked');
  const review = prs.filter((p) => p.policy.verdict === 'review_required');
  const pass = prs.filter((p) => p.policy.verdict === 'pass');

  return (
    <>
      <div className="section">
        <div className="section-header"><span className="section-header-title">All Open PRs — Governance View</span></div>
        {prs.length === 0 ? (
          <EmptyState message="No open PRs to evaluate." />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 56 }}>PR</th>
                  <th>Repo</th>
                  <th>Title</th>
                  <th style={{ width: 100 }}>Verdict</th>
                  <th style={{ width: 56 }}>Score</th>
                  <th style={{ width: 120 }}>Required Approver</th>
                  <th style={{ width: 70 }}>CI</th>
                </tr>
              </thead>
              <tbody>
                {prs.map((pr) => {
                  const vm = VERDICT_META[pr.policy.verdict];
                  return (
                    <tr key={pr.id}>
                      <td><Link href={`/projects/${pr.projectId}/prs/${pr.id}`} style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--blue)' }}>#{pr.prNumber}</Link></td>
                      <td style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{pr.repoLabel.length > 24 ? pr.repoLabel.slice(0, 24) + '…' : pr.repoLabel}</td>
                      <td style={{ maxWidth: 280 }}>
                        <Link href={`/projects/${pr.projectId}/prs/${pr.id}`} style={{ fontSize: 13, color: 'var(--text)' }}>{pr.title.length > 56 ? pr.title.slice(0, 56) + '…' : pr.title}</Link>
                        {pr.policy.violatedPolicies[0] && (
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{pr.policy.reason}</div>
                        )}
                      </td>
                      <td><span className={`badge ${vm.badge}`} style={{ fontSize: 10 }}>{vm.label}</span></td>
                      <td style={{ fontWeight: 700, fontSize: 13 }}>{pr.policy.policyScore > 0 ? pr.policy.policyScore : '—'}</td>
                      <td style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{APPROVER_LABEL[pr.policy.requiredApprover]}</td>
                      <td>{pr.ciStatus ? <span className={`badge ${pr.ciStatus === 'success' ? 'badge-success' : pr.ciStatus === 'failure' ? 'badge-sev-high' : 'badge-neutral'}`} style={{ fontSize: 10 }}>{pr.ciStatus}</span> : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

// ── Repo Health content ───────────────────────────────────────────────────────

function RepoHealthContent({ projects }: { projects: ReportProject[] }) {
  return (
    <div className="section">
      <div className="section-header"><span className="section-header-title">Per-Repo Health Status</span></div>
      {projects.length === 0 ? (
        <EmptyState message="No projects imported yet." action={<Link href="/projects/new" className="btn btn-primary">Import a project</Link>} />
      ) : (
        <RepoHealthTable projects={projects} />
      )}
    </div>
  );
}

// ── Merge Readiness content ───────────────────────────────────────────────────

function MergeReadinessContent({ prs }: { prs: PrRow[] }) {
  const ready = prs.filter((p) => p.policy.mergeRecommendation === 'safe_to_merge');
  const review = prs.filter((p) => p.policy.mergeRecommendation === 'review_first');
  const blocked = prs.filter((p) => p.policy.mergeRecommendation === 'do_not_merge');

  const MergeTable = ({ items, emptyMsg }: { items: PrRow[]; emptyMsg: string }) =>
    items.length === 0 ? (
      <div className="feed-card" style={{ fontSize: 13, color: 'var(--text-muted)' }}>{emptyMsg}</div>
    ) : (
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: 56 }}>PR</th>
              <th>Repo</th>
              <th>Title</th>
              <th style={{ width: 70 }}>CI</th>
              <th>Policy Reason / Approver</th>
            </tr>
          </thead>
          <tbody>
            {items.map((pr) => (
              <tr key={pr.id}>
                <td><Link href={`/projects/${pr.projectId}/prs/${pr.id}`} style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--blue)' }}>#{pr.prNumber}</Link></td>
                <td style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{pr.repoLabel.length > 22 ? pr.repoLabel.slice(0, 22) + '…' : pr.repoLabel}</td>
                <td style={{ maxWidth: 260 }}><Link href={`/projects/${pr.projectId}/prs/${pr.id}`} style={{ fontSize: 13, color: 'var(--text)' }}>{pr.title.length > 52 ? pr.title.slice(0, 52) + '…' : pr.title}</Link></td>
                <td>{pr.ciStatus ? <span className={`badge ${pr.ciStatus === 'success' ? 'badge-success' : pr.ciStatus === 'failure' ? 'badge-sev-high' : 'badge-neutral'}`} style={{ fontSize: 10 }}>{pr.ciStatus}</span> : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>}</td>
                <td style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                  {pr.policy.reason.length > 60 ? pr.policy.reason.slice(0, 60) + '…' : pr.policy.reason}
                  {pr.policy.requiredApprover !== 'none' && ` · ${APPROVER_LABEL[pr.policy.requiredApprover]}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );

  return (
    <>
      <div className="section">
        <div className="section-header"><span className="section-header-title" style={{ color: 'var(--green)' }}>✓ Ready to Merge</span><span className="section-header-count">{ready.length}</span></div>
        <MergeTable items={ready} emptyMsg="No PRs ready to merge yet." />
      </div>
      <div className="section">
        <div className="section-header"><span className="section-header-title" style={{ color: 'var(--amber)' }}>⚑ Review First</span><span className="section-header-count">{review.length}</span></div>
        <MergeTable items={review} emptyMsg="No PRs requiring review." />
      </div>
      <div className="section">
        <div className="section-header"><span className="section-header-title" style={{ color: 'var(--red)' }}>⛔ Do Not Merge</span><span className="section-header-count">{blocked.length}</span></div>
        <MergeTable items={blocked} emptyMsg="No blocked PRs." />
      </div>
    </>
  );
}

// ── Agent Quality content ─────────────────────────────────────────────────────

function AgentQualityContent({ agentRuns, totalTasks }: { agentRuns: ReportAgentRun[]; totalTasks: number }) {
  const succeeded = agentRuns.filter((r) => r.status === 'succeeded').length;
  const failed = agentRuns.filter((r) => r.status === 'failed').length;

  return (
    <div className="section">
      <div className="section-header"><span className="section-header-title">Recent Agent Runs</span></div>
      {agentRuns.length === 0 ? (
        <EmptyState message="No agent runs recorded yet. Sessions will appear here once Claude tasks are tracked." />
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Task</th>
                <th>Project</th>
                <th style={{ width: 90 }}>Status</th>
                <th style={{ width: 80 }}>Risk</th>
                <th>Model</th>
                <th style={{ width: 140 }}>Started</th>
              </tr>
            </thead>
            <tbody>
              {agentRuns.slice(0, 20).map((r) => (
                <tr key={r.id}>
                  <td style={{ maxWidth: 220, fontSize: 13 }}>{r.taskTitle.length > 44 ? r.taskTitle.slice(0, 44) + '…' : r.taskTitle}</td>
                  <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{r.projectName}</td>
                  <td>
                    <span className={`badge ${r.status === 'succeeded' ? 'badge-success' : r.status === 'failed' ? 'badge-sev-high' : 'badge-neutral'}`} style={{ fontSize: 10 }}>
                      {r.status}
                    </span>
                  </td>
                  <td style={{ fontSize: 12, fontWeight: r.riskScore && r.riskScore > 60 ? 700 : undefined, color: r.riskScore && r.riskScore > 60 ? 'var(--red)' : 'var(--text)' }}>
                    {r.riskScore != null ? `${r.riskScore.toFixed(0)}/100` : '—'}
                  </td>
                  <td style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{r.modelUsed ?? '—'}</td>
                  <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.startedAt.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function PolicyPrCard({ pr, borderColor, dotClass, compact = false }: { pr: PrRow; borderColor: string; dotClass: string; compact?: boolean }) {
  const vm = VERDICT_META[pr.policy.verdict];
  return (
    <div className="feed-card" style={{ borderLeft: `3px solid ${borderColor}`, paddingLeft: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: compact ? 0 : 6 }}>
        <span className={`status-dot ${dotClass}`} />
        <Link href={`/projects/${pr.projectId}/prs/${pr.id}`} style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--blue)', minWidth: 36 }}>#{pr.prNumber}</Link>
        <Link href={`/projects/${pr.projectId}/prs/${pr.id}`} style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', flex: 1 }}>{pr.title.length > 72 ? pr.title.slice(0, 72) + '…' : pr.title}</Link>
        <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{pr.repoLabel}</span>
        <span className={`badge ${vm.badge}`} style={{ fontSize: 10 }}>{vm.label}</span>
        {pr.ciStatus && <span className={`badge ${pr.ciStatus === 'success' ? 'badge-success' : pr.ciStatus === 'failure' ? 'badge-sev-high' : 'badge-neutral'}`} style={{ fontSize: 10 }}>{pr.ciStatus}</span>}
      </div>
      {!compact && (
        <>
          <div style={{ paddingLeft: 24, fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
            {pr.policy.founderExplanation.length > 160 ? pr.policy.founderExplanation.slice(0, 160) + '…' : pr.policy.founderExplanation}
          </div>
          <div style={{ paddingLeft: 24, display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)' }}>{pr.policy.reason}</span>
            <span style={{ fontSize: 11, color: 'var(--blue)' }}>→ {pr.policy.recommendedNextAction.length > 80 ? pr.policy.recommendedNextAction.slice(0, 80) + '…' : pr.policy.recommendedNextAction}</span>
          </div>
        </>
      )}
      {compact && pr.policy.reason && (
        <div style={{ paddingLeft: 24, fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
          {pr.policy.reason}
          {pr.policy.requiredApprover !== 'none' && ` · Required: ${APPROVER_LABEL[pr.policy.requiredApprover]}`}
        </div>
      )}
    </div>
  );
}

function RepoHealthTable({ projects }: { projects: ReportProject[] }) {
  if (projects.length === 0) return <EmptyState message="No projects." />;
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>Repository</th>
            <th style={{ width: 70, textAlign: 'right' }}>Open PRs</th>
            <th style={{ width: 80, textAlign: 'right' }}>Blocked</th>
            <th style={{ width: 100, textAlign: 'right' }}>Review Req.</th>
            <th style={{ width: 64, textAlign: 'right' }}>Pass</th>
            <th style={{ width: 70, textAlign: 'right' }}>Failed CI</th>
            <th style={{ width: 80 }}>Health</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((p) => {
            const repoLabel = p.repoOwner && p.repoName ? `${p.repoOwner}/${p.repoName}` : p.name;
            const isHealthy = p.policyBlocked === 0 && p.failedCIPRs === 0;
            const isCaution = !isHealthy && p.policyBlocked === 0;
            return (
              <tr key={p.id}>
                <td>
                  <Link href={`/projects/${p.id}/prs`} style={{ fontSize: 13, color: 'var(--blue)', fontFamily: 'monospace' }}>
                    {repoLabel}
                  </Link>
                </td>
                <td style={{ textAlign: 'right', fontSize: 13 }}>{p.openPRs}</td>
                <td style={{ textAlign: 'right' }}>
                  {p.policyBlocked > 0 ? <span style={{ fontWeight: 700, color: 'var(--red)', fontSize: 13 }}>{p.policyBlocked}</span> : <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>0</span>}
                </td>
                <td style={{ textAlign: 'right' }}>
                  {p.policyReviewRequired > 0 ? <span style={{ fontWeight: 700, color: 'var(--amber)', fontSize: 13 }}>{p.policyReviewRequired}</span> : <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>0</span>}
                </td>
                <td style={{ textAlign: 'right', fontSize: 13, color: 'var(--text-muted)' }}>{p.policyPass}</td>
                <td style={{ textAlign: 'right' }}>
                  {p.failedCIPRs > 0 ? <span style={{ fontWeight: 700, color: 'var(--red)', fontSize: 13 }}>{p.failedCIPRs}</span> : <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>0</span>}
                </td>
                <td>
                  {isHealthy ? (
                    <span className="badge badge-success" style={{ fontSize: 10 }}>Healthy</span>
                  ) : isCaution ? (
                    <span className="badge badge-warning" style={{ fontSize: 10 }}>Caution</span>
                  ) : (
                    <span className="badge badge-sev-high" style={{ fontSize: 10 }}>At Risk</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function EmptyState({ message, action }: { message: string; action?: React.ReactNode }) {
  return (
    <div style={{ padding: '32px 24px', textAlign: 'center', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }}>
      <div style={{ fontSize: 28, marginBottom: 10 }}>◈</div>
      <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: action ? 16 : 0 }}>{message}</div>
      {action}
    </div>
  );
}
