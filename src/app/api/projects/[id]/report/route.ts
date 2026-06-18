import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';
import { requireRole } from '@/lib/rbac';
import {
  htmlWrapper,
  htmlBadge,
  htmlSection,
  htmlTable,
  escapeHtml,
} from '@/lib/reportTemplates';

// GET /api/projects/[id]/report — returns a self-contained HTML summary report.
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

  const project = await prisma.project.findUnique({
    where: { id: params.id },
    include: {
      tasks: {
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          title: true,
          status: true,
          riskLevel: true,
          agentTool: true,
          createdAt: true,
        },
      },
      milestones: {
        orderBy: { targetDate: 'asc' },
        include: { _count: { select: { tasks: true } } },
      },
    },
  });

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  // Task counts by status
  const taskCounts = await prisma.task.groupBy({
    by: ['status'],
    where: { projectId: params.id },
    _count: { _all: true },
  });

  const countByStatus: Record<string, number> = {};
  for (const row of taskCounts) {
    countByStatus[row.status] = row._count._all;
  }
  const totalTasks = Object.values(countByStatus).reduce((a, b) => a + b, 0);
  const completedTasks = countByStatus['completed'] ?? 0;
  const completedPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Per-milestone completed counts
  const milestoneIds = project.milestones.map((m) => m.id);
  const milestoneCompletedCounts: Record<string, number> = {};
  if (milestoneIds.length > 0) {
    const completedPerMilestone = await prisma.task.groupBy({
      by: ['milestoneId'],
      where: { milestoneId: { in: milestoneIds }, status: 'completed' },
      _count: { _all: true },
    });
    for (const row of completedPerMilestone) {
      if (row.milestoneId) {
        milestoneCompletedCounts[row.milestoneId] = row._count._all;
      }
    }
  }

  const generatedAt = new Date().toUTCString();

  // ── 1. Report header ──────────────────────────────────────────────────────
  const header = `<div class="report-header">
  <div class="brand">Coder by DevAscend — Project Report</div>
  <h1>${escapeHtml(project.name)}</h1>
  ${project.description ? `<p style="color:#475569;margin-top:6px;">${escapeHtml(project.description)}</p>` : ''}
  <div class="timestamp">Generated: ${escapeHtml(generatedAt)}</div>
</div>`;

  // ── 2. Task progress ──────────────────────────────────────────────────────
  const statusColors: Record<string, string> = {
    pending:   'gray',
    running:   'blue',
    completed: 'green',
    failed:    'red',
  };

  const statRows = Object.entries(countByStatus).map(([status, count]) => [
    htmlBadge(status, statusColors[status] ?? 'gray'),
    String(count),
    `${totalTasks > 0 ? Math.round((count / totalTasks) * 100) : 0}%`,
  ]);

  const progressBar = `
<div style="background:#e2e8f0;border-radius:6px;height:16px;overflow:hidden;margin-bottom:14px;">
  <div style="background:#22c55e;height:100%;width:${completedPct}%;transition:width 0.3s;"></div>
</div>
<p style="font-size:13px;color:#475569;margin-bottom:16px;">${completedTasks} of ${totalTasks} tasks completed (${completedPct}%)</p>
${statRows.length > 0 ? htmlTable(['Status', 'Count', 'Percentage'], statRows) : '<p>No tasks yet.</p>'}`;

  const progressSection = htmlSection('Task Progress', progressBar);

  // ── 3. Recent tasks ───────────────────────────────────────────────────────
  const riskColors: Record<string, string> = { low: 'green', medium: 'amber', high: 'red' };

  let recentTasksContent: string;
  if (project.tasks.length === 0) {
    recentTasksContent = '<p>No tasks in this project.</p>';
  } else {
    const rows = project.tasks.map((t) => [
      `<a href="/tasks/${escapeHtml(t.id)}" style="color:#6366f1;">${escapeHtml(t.title)}</a>`,
      htmlBadge(t.status, statusColors[t.status] ?? 'gray'),
      htmlBadge(t.riskLevel, riskColors[t.riskLevel] ?? 'gray'),
      escapeHtml(t.agentTool),
      escapeHtml(t.createdAt.toLocaleDateString()),
    ]);
    recentTasksContent = htmlTable(['Title', 'Status', 'Risk', 'Agent Tool', 'Created'], rows);
  }

  const recentTasksSection = htmlSection('Recent Tasks', recentTasksContent);

  // ── 4. Milestone progress ─────────────────────────────────────────────────
  let milestoneContent: string;
  if (project.milestones.length === 0) {
    milestoneContent = '<p>No milestones defined for this project.</p>';
  } else {
    const rows = project.milestones.map((m) => {
      const total = m._count.tasks;
      const completed = milestoneCompletedCounts[m.id] ?? 0;
      const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
      return [
        escapeHtml(m.title),
        htmlBadge(m.status, m.status === 'completed' ? 'green' : 'blue'),
        m.targetDate ? escapeHtml(m.targetDate.toLocaleDateString()) : '—',
        `${completed}/${total}`,
        `${pct}%`,
      ];
    });
    milestoneContent = htmlTable(['Milestone', 'Status', 'Target Date', 'Tasks Done', 'Progress'], rows);
  }

  const milestoneSection = htmlSection('Milestone Progress', milestoneContent);

  // ── 5. Footer ─────────────────────────────────────────────────────────────
  const footer = `<div class="footer">
  Report generated by Coder by DevAscend on ${escapeHtml(generatedAt)}
</div>`;

  // ── Assemble ──────────────────────────────────────────────────────────────
  const body = [
    header,
    progressSection,
    recentTasksSection,
    milestoneSection,
    footer,
  ].join('\n\n');

  const html = htmlWrapper(`Project Report — ${project.name}`, body);

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
