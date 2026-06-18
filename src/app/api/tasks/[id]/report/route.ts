import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';
import { requireRole } from '@/lib/rbac';
import { analyzeRisk } from '@/lib/riskAnalyzer';
import {
  htmlWrapper,
  htmlBadge,
  htmlSection,
  htmlTable,
  escapeHtml,
} from '@/lib/reportTemplates';

// GET /api/tasks/[id]/report — returns a self-contained HTML governance report.
export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  // Auth: any authenticated user may download a report.
  const currentUser = await getCurrentUser();
  const roleCheck = requireRole(currentUser, 'any');
  if (!roleCheck.ok) {
    return NextResponse.json(
      { error: roleCheck.status === 401 ? 'Unauthorized' : 'Forbidden' },
      { status: roleCheck.status },
    );
  }

  const task = await prisma.task.findUnique({
    where: { id: params.id },
    include: {
      project: true,
      assignee: true,
      milestone: true,
      approval: { include: { user: true } },
      agentRuns: {
        include: { provider: true, evaluations: true },
        orderBy: { startedAt: 'asc' },
      },
      audits: { include: { user: true }, orderBy: { createdAt: 'asc' } },
    },
  });

  if (!task) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  }

  const prs = await prisma.githubPR.findMany({ where: { taskId: params.id } });

  const generatedAt = new Date().toUTCString();

  // ── 1. Report header ──────────────────────────────────────────────────────
  const header = `<div class="report-header">
  <div class="brand">Coder by DevAscend — AI Governance Report</div>
  <h1>AI Governance Report</h1>
  <div class="timestamp">Generated: ${escapeHtml(generatedAt)}</div>
</div>`;

  // ── 2. Task summary box ───────────────────────────────────────────────────
  const statusColors: Record<string, string> = {
    pending:   'gray',
    running:   'blue',
    completed: 'green',
    failed:    'red',
  };
  const riskColors: Record<string, string> = {
    low:    'green',
    medium: 'amber',
    high:   'red',
  };

  const summaryFields = [
    ['Title', escapeHtml(task.title)],
    ['Project', escapeHtml(task.project?.name ?? '—')],
    ['Status', htmlBadge(task.status, statusColors[task.status] ?? 'gray')],
    ['Risk Level', htmlBadge(task.riskLevel, riskColors[task.riskLevel] ?? 'gray')],
    ['Environment', escapeHtml(task.environment)],
    ['Approval Required', task.approvalRequired ? 'Yes' : 'No'],
    ['Priority', escapeHtml(task.priority)],
    ['Milestone', escapeHtml(task.milestone?.title ?? '—')],
    ['Assignee', escapeHtml(task.assignee?.name ?? task.assignee?.email ?? '—')],
    ['Task ID', `<code>${escapeHtml(task.id)}</code>`],
    ['Created', escapeHtml(task.createdAt.toUTCString())],
  ];

  const summaryBox = `<div class="summary-box">
  ${summaryFields.map(([label, value]) => `<div class="field"><span class="field-label">${label}</span><span class="field-value">${value}</span></div>`).join('\n  ')}
</div>`;

  const summarySection = htmlSection('Task Summary', summaryBox);

  // ── 3. Plain-English summary ──────────────────────────────────────────────
  const latestRun = task.agentRuns.at(-1);
  const agentName = latestRun?.provider?.name ?? latestRun?.selectedTool ?? 'an AI agent';
  const outcomeMap: Record<string, string> = {
    completed: 'The task completed successfully.',
    failed: 'The task encountered an error and did not complete.',
    running: 'The task is currently in progress.',
    pending: 'The task has not yet been executed.',
  };
  const outcome = outcomeMap[task.status] ?? 'The current status is unknown.';

  const plainSummary = `<p>
  This task, titled <strong>${escapeHtml(task.title)}</strong>, was requested in the
  <strong>${escapeHtml(task.project?.name ?? 'unknown project')}</strong> project.
  ${task.agentRuns.length > 0
    ? `It was executed by <strong>${escapeHtml(agentName)}</strong> across ${task.agentRuns.length} agent run(s).`
    : 'No agent runs have been recorded yet.'}
  ${outcome}
</p>`;

  const plainSection = htmlSection('Summary', plainSummary);

  // ── 4. Execution section ──────────────────────────────────────────────────
  let executionContent: string;
  if (task.agentRuns.length === 0) {
    executionContent = '<p>No agent runs recorded for this task.</p>';
  } else {
    executionContent = task.agentRuns
      .map((run, index) => {
        const runStatusColors: Record<string, string> = {
          succeeded: 'green',
          failed: 'red',
          running: 'blue',
          pending: 'gray',
        };
        const evalSummary = run.evaluations.length > 0
          ? run.evaluations.map((e) => `${escapeHtml(e.name)}: ${e.passed ? '✓ passed' : '✗ failed'}${e.score != null ? ` (score: ${e.score})` : ''}`).join(', ')
          : '—';

        return `<div style="margin-bottom:16px;padding:14px 16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;">
  <h3>Run #${index + 1} — ${htmlBadge(run.status, runStatusColors[run.status] ?? 'gray')} &nbsp; <span style="font-size:12px;color:#64748b;font-weight:400;">${escapeHtml(run.startedAt.toUTCString())}</span></h3>
  <div class="summary-box" style="margin-top:10px;margin-bottom:0;">
    <div class="field"><span class="field-label">Provider</span><span class="field-value">${escapeHtml(run.provider?.name ?? run.selectedTool ?? '—')}</span></div>
    <div class="field"><span class="field-label">Files Changed</span><span class="field-value">${run.filesChanged ? `<code>${escapeHtml(run.filesChanged)}</code>` : '—'}</span></div>
    <div class="field"><span class="field-label">Commands Run</span><span class="field-value">${run.commandsRun ? `<code>${escapeHtml(run.commandsRun)}</code>` : '—'}</span></div>
    <div class="field"><span class="field-label">Test Result</span><span class="field-value">${run.testResult ? escapeHtml(run.testResult) : '—'}</span></div>
    <div class="field"><span class="field-label">Commit Hash</span><span class="field-value">${run.commitHash ? `<code>${escapeHtml(run.commitHash)}</code>` : '—'}</span></div>
    <div class="field"><span class="field-label">Evaluations</span><span class="field-value">${evalSummary}</span></div>
    ${run.endedAt ? `<div class="field"><span class="field-label">Ended</span><span class="field-value">${escapeHtml(run.endedAt.toUTCString())}</span></div>` : ''}
  </div>
</div>`;
      })
      .join('\n');
  }

  const executionSection = htmlSection('Execution', executionContent);

  // ── 5. Approval record ────────────────────────────────────────────────────
  let approvalContent: string;
  if (!task.approval) {
    approvalContent = '<p>No approval record exists for this task.</p>';
  } else {
    const a = task.approval;
    const approverName = a.user?.name ?? a.user?.email ?? 'Pending';
    const decision = a.approved === true ? htmlBadge('Approved', 'green')
      : a.approved === false ? htmlBadge('Rejected', 'red')
      : htmlBadge('Pending', 'gray');
    approvalContent = `<div class="summary-box">
  <div class="field"><span class="field-label">Approver</span><span class="field-value">${escapeHtml(approverName)}</span></div>
  <div class="field"><span class="field-label">Decision</span><span class="field-value">${decision}</span></div>
  <div class="field"><span class="field-label">Record Created</span><span class="field-value">${escapeHtml(a.createdAt.toUTCString())}</span></div>
  <div class="field"><span class="field-label">Last Updated</span><span class="field-value">${escapeHtml(a.updatedAt.toUTCString())}</span></div>
</div>`;
  }

  const approvalSection = htmlSection('Approval Record', approvalContent);

  // ── 6. Risk flags ─────────────────────────────────────────────────────────
  const riskFlags = analyzeRisk(task.instruction);
  const isHighRisk = task.riskLevel === 'high';

  let riskContent: string;
  if (riskFlags.length === 0 && !isHighRisk) {
    riskContent = '<p>No high-risk indicators detected.</p>';
  } else {
    const items: string[] = [];
    if (isHighRisk) {
      items.push(`<li class="high">Task is marked <strong>high risk</strong> by the author.</li>`);
    }
    for (const flag of riskFlags) {
      const isHigh = flag.severity === 'high' || isHighRisk;
      items.push(`<li class="${isHigh ? 'high' : ''}">${escapeHtml(flag.label ?? flag.key)}</li>`);
    }
    riskContent = `<ul class="risk-list">${items.join('\n')}</ul>`;
  }

  const riskSection = htmlSection('Risk Flags', riskContent);

  // ── 7. Audit timeline ─────────────────────────────────────────────────────
  let auditContent: string;
  if (task.audits.length === 0) {
    auditContent = '<p>No audit events recorded.</p>';
  } else {
    const rows = task.audits.map((a) => [
      escapeHtml(a.createdAt.toUTCString()),
      escapeHtml(a.event),
      escapeHtml(a.user?.name ?? a.user?.email ?? '—'),
      a.details ? `<code style="word-break:break-all;">${escapeHtml(a.details)}</code>` : '—',
    ]);
    auditContent = htmlTable(['Timestamp', 'Event', 'Actor', 'Details'], rows);
  }

  const auditSection = htmlSection('Audit Timeline', auditContent);

  // ── 8. GitHub PRs ─────────────────────────────────────────────────────────
  let prContent: string;
  if (prs.length === 0) {
    prContent = '<p>No linked GitHub pull requests.</p>';
  } else {
    const prStateColors: Record<string, string> = {
      open:   'blue',
      closed: 'gray',
      merged: 'purple',
    };
    const ciColors: Record<string, string> = {
      success: 'green',
      failure: 'red',
      pending: 'amber',
      neutral: 'gray',
    };
    const rows = prs.map((pr) => [
      `<a href="${escapeHtml(pr.prUrl ?? '#')}" target="_blank" rel="noopener noreferrer">#${pr.prNumber}</a>`,
      escapeHtml(pr.title),
      htmlBadge(pr.state, prStateColors[pr.state] ?? 'gray'),
      pr.ciStatus ? htmlBadge(pr.ciStatus, ciColors[pr.ciStatus] ?? 'gray') : '—',
    ]);
    prContent = htmlTable(['PR', 'Title', 'State', 'CI Status'], rows);
  }

  const prSection = htmlSection('GitHub Pull Requests', prContent);

  // ── 9. Footer ─────────────────────────────────────────────────────────────
  const footer = `<div class="footer">
  Report generated by Coder by DevAscend on ${escapeHtml(generatedAt)}
</div>`;

  // ── Assemble ──────────────────────────────────────────────────────────────
  const body = [
    header,
    summarySection,
    plainSection,
    executionSection,
    approvalSection,
    riskSection,
    auditSection,
    prSection,
    footer,
  ].join('\n\n');

  const html = htmlWrapper(`AI Governance Report — ${task.title}`, body);

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
