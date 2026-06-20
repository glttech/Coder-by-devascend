import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { PDF_PRINT_CSS } from '@/lib/pdfStyles';
import { buildPrompt } from '@/lib/promptBuilder';
import { getCurrentUser } from '@/lib/session';
import { requireRole } from '@/lib/rbac';

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  const auth = requireRole(user, 'any');
  if (!auth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: auth.status });
  const task = await prisma.task.findUnique({
    where: { id: params.id },
    include: {
      agentRuns: { include: { evaluations: true } },
      project: true,
      approval: true,
      instructions: { orderBy: { createdAt: 'asc' } },
    },
  });

  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const prompt = buildPrompt(task);
  const generatedAt = new Date().toLocaleString();

  const riskClass = task.riskLevel === 'high' ? 'badge-high' : task.riskLevel === 'medium' ? 'badge-medium' : 'badge-low';

  const runsHtml = task.agentRuns.length === 0 ? '<p>No agent runs recorded.</p>' : task.agentRuns.map(run => `
    <h3>Run ${run.id.slice(0, 8)} — <span style="color:#6b7280">${run.selectedTool}</span> — ${run.status}</h3>
    <pre>${escapeHtml(run.response || 'No response')}</pre>
    ${run.evaluations.length > 0 ? `<table><thead><tr><th>Evaluation</th><th>Passed</th><th>Score</th><th>Reason</th></tr></thead><tbody>
      ${run.evaluations.map(e => `<tr><td>${escapeHtml(e.name)}</td><td>${e.passed ? '✓' : '✗'}</td><td>${e.score ?? '—'}</td><td>${escapeHtml(e.reason ?? '')}</td></tr>`).join('')}
    </tbody></table>` : ''}
  `).join('<hr style="border:none;border-top:1px dashed #ddd;margin:12px 0">');

  const approvalHtml = task.approval
    ? `<p>Approved: ${task.approval.approved === true ? 'Yes' : task.approval.approved === false ? 'No' : 'Pending'}</p>`
    : '<p>No approval record.</p>';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Task Report — ${escapeHtml(task.title)}</title>
  <style>${PDF_PRINT_CSS}</style>
</head>
<body>
  <div class="header-block">
    <h1>${escapeHtml(task.title)}</h1>
    <p style="color:#6b7280;font-size:11px;margin:4px 0">${escapeHtml(task.id)} · Generated ${escapeHtml(generatedAt)}</p>
    <span class="badge ${riskClass}">${escapeHtml(task.riskLevel)} risk</span>
  </div>

  <h2>Task Details</h2>
  <div class="meta-row"><span class="meta-label">Status</span><span class="meta-value">${escapeHtml(task.status)}</span></div>
  <div class="meta-row"><span class="meta-label">Environment</span><span class="meta-value">${escapeHtml(task.environment)}</span></div>
  <div class="meta-row"><span class="meta-label">Agent Tool</span><span class="meta-value">${escapeHtml(task.agentTool)}</span></div>
  <div class="meta-row"><span class="meta-label">Approval Required</span><span class="meta-value">${task.approvalRequired ? 'Yes' : 'No'}</span></div>
  ${task.project ? `<div class="meta-row"><span class="meta-label">Project</span><span class="meta-value">${escapeHtml(task.project.name)}</span></div>` : ''}

  <h2>Instruction</h2>
  <p>${escapeHtml(task.instruction)}</p>

  <h2>Generated Prompt</h2>
  <pre>${escapeHtml(prompt)}</pre>

  <h2>Agent Runs (${task.agentRuns.length})</h2>
  ${runsHtml}

  <h2>Approval</h2>
  ${approvalHtml}

  <div class="footer">
    <p>Coder by DevAscend — Task Evidence Report — ${escapeHtml(generatedAt)}</p>
    <button onclick="window.print()" style="margin-top:8px;padding:6px 14px;border:1px solid #ddd;border-radius:4px;cursor:pointer;font-size:11px" class="no-print">
      Print / Save as PDF
    </button>
  </div>
  <style>@media print { .no-print { display: none; } }</style>
</body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
