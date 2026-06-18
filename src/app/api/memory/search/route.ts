import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';
import { requireRole } from '@/lib/rbac';
import {
  detectIntent,
  buildExcerpt,
  isLlmSummaryEnabled,
  generateLlmSummary,
  type MemoryResult,
  type MemoryResultType,
  type QueryIntent,
} from '@/lib/memorySearch';

export const dynamic = 'force-dynamic';

/**
 * GET /api/memory/search
 * Unified repository memory search across PRs, tasks, audit logs, and traces.
 *
 * Query params:
 *   q          search query (min 2 chars)
 *   projectId  optional — scope to a single project
 *   types      comma-separated: pr,task,audit_log,trace (default: all)
 *   since      ISO date filter (inclusive)
 *   until      ISO date filter (inclusive)
 *   limit      max results (default 30, max 100)
 *   llm        "1" to request LLM summary (only works if FEATURE_REPO_MEMORY_LLM=true)
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  const auth = requireRole(user, 'any');
  if (!auth.ok) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: auth.status });
  }

  const { searchParams } = new URL(request.url);

  const q = (searchParams.get('q') ?? '').trim();
  if (q.length < 2) {
    return NextResponse.json({ results: [], total: 0, query: q, intent: 'general' });
  }

  const projectId = searchParams.get('projectId') ?? undefined;
  const typesParam = searchParams.get('types');
  const requestedTypes: MemoryResultType[] = typesParam
    ? (typesParam.split(',').filter((t) =>
        ['pr', 'task', 'audit_log', 'trace'].includes(t),
      ) as MemoryResultType[])
    : ['pr', 'task', 'audit_log', 'trace'];

  const since = searchParams.get('since') ? new Date(searchParams.get('since')!) : undefined;
  const until = searchParams.get('until') ? new Date(searchParams.get('until')!) : undefined;
  const limitRaw = parseInt(searchParams.get('limit') ?? '30', 10);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(1, limitRaw), 100) : 30;
  const wantLlm = searchParams.get('llm') === '1';

  const intent: QueryIntent = detectIntent(q);

  const results: MemoryResult[] = [];

  // ── Search PRs ──────────────────────────────────────────────────────────────
  if (requestedTypes.includes('pr')) {
    const prWhere: Record<string, unknown> = {
      OR: [
        { title: { contains: q, mode: 'insensitive' } },
        { body: { contains: q, mode: 'insensitive' } },
        { author: { contains: q, mode: 'insensitive' } },
        { sourceBranch: { contains: q, mode: 'insensitive' } },
      ],
    };
    if (projectId) prWhere['projectId'] = projectId;
    if (since || until) {
      const df: Record<string, Date> = {};
      if (since) df['gte'] = since;
      if (until) df['lte'] = until;
      prWhere['OR'] = [
        ...(prWhere['OR'] as object[]),
      ];
      // Apply date filter separately
      prWhere['githubMergedAt'] = df;
    }

    const prs = await prisma.githubPR.findMany({
      where: prWhere,
      orderBy: [{ githubMergedAt: 'desc' }, { importedAt: 'desc' }],
      take: Math.ceil(limit * 0.5),
      select: {
        id: true, prNumber: true, title: true, body: true,
        author: true, prUrl: true, state: true, merged: true,
        classification: true, bugState: true, ciStatus: true,
        githubMergedAt: true, labels: true, projectId: true,
        project: { select: { name: true } },
      },
    });

    for (const pr of prs) {
      const citations = [
        { label: 'Project', value: pr.project.name, url: `/projects/${pr.projectId}` },
        { label: 'Author', value: pr.author ?? 'unknown' },
        { label: 'Status', value: pr.merged ? 'merged' : pr.state },
        ...(pr.classification ? [{ label: 'Type', value: pr.classification.replace('_', ' ') }] : []),
        ...(pr.ciStatus ? [{ label: 'CI', value: pr.ciStatus }] : []),
      ];

      results.push({
        id: pr.id,
        type: 'pr',
        title: `#${pr.prNumber} ${pr.title}`,
        subtitle: `${pr.project.name} · ${pr.merged ? 'merged' : pr.state}`,
        url: pr.prUrl ?? `/projects/${pr.projectId}/prs`,
        excerpt: buildExcerpt(pr.title + ' ' + (pr.body ?? ''), q),
        citations,
        date: pr.githubMergedAt?.toISOString() ?? null,
        classification: pr.classification ?? undefined,
        bugState: pr.bugState,
      });
    }
  }

  // ── Search tasks ────────────────────────────────────────────────────────────
  if (requestedTypes.includes('task')) {
    const taskWhere: Record<string, unknown> = {
      OR: [
        { title: { contains: q, mode: 'insensitive' } },
        { instruction: { contains: q, mode: 'insensitive' } },
      ],
    };
    if (projectId) taskWhere['projectId'] = projectId;
    if (since || until) {
      const df: Record<string, Date> = {};
      if (since) df['gte'] = since;
      if (until) df['lte'] = until;
      taskWhere['createdAt'] = df;
    }

    const tasks = await prisma.task.findMany({
      where: taskWhere,
      orderBy: { updatedAt: 'desc' },
      take: Math.ceil(limit * 0.3),
      select: {
        id: true, title: true, instruction: true, status: true,
        riskLevel: true, environment: true, updatedAt: true,
        project: { select: { id: true, name: true } },
      },
    });

    for (const task of tasks) {
      results.push({
        id: task.id,
        type: 'task',
        title: task.title,
        subtitle: `${task.project.name} · ${task.status} · ${task.riskLevel} risk`,
        url: `/tasks/${task.id}`,
        excerpt: buildExcerpt(task.title + ' ' + task.instruction, q),
        citations: [
          { label: 'Project', value: task.project.name, url: `/projects/${task.project.id}` },
          { label: 'Status', value: task.status },
          { label: 'Risk', value: task.riskLevel },
          { label: 'Env', value: task.environment },
        ],
        date: task.updatedAt.toISOString(),
      });
    }
  }

  // ── Search audit logs ───────────────────────────────────────────────────────
  if (requestedTypes.includes('audit_log')) {
    const auditWhere: Record<string, unknown> = {
      OR: [
        { event: { contains: q, mode: 'insensitive' } },
        { details: { contains: q, mode: 'insensitive' } },
      ],
    };
    if (since || until) {
      const df: Record<string, Date> = {};
      if (since) df['gte'] = since;
      if (until) df['lte'] = until;
      auditWhere['createdAt'] = df;
    }

    const audits = await prisma.auditLog.findMany({
      where: auditWhere,
      orderBy: { createdAt: 'desc' },
      take: Math.ceil(limit * 0.2),
      select: {
        id: true, event: true, details: true, createdAt: true,
        taskId: true, agentRunId: true,
        task: { select: { title: true } },
      },
    });

    for (const audit of audits) {
      const taskTitle = audit.task?.title;
      results.push({
        id: audit.id,
        type: 'audit_log',
        title: audit.event.replace(/_/g, ' '),
        subtitle: taskTitle ? `Task: ${taskTitle}` : 'System audit',
        url: audit.taskId ? `/tasks/${audit.taskId}` : '/audit',
        excerpt: buildExcerpt(audit.event + ' ' + (audit.details ?? ''), q),
        citations: [
          { label: 'Event', value: audit.event },
          { label: 'Date', value: audit.createdAt.toLocaleDateString() },
          ...(audit.taskId ? [{ label: 'Task', value: taskTitle ?? audit.taskId, url: `/tasks/${audit.taskId}` }] : []),
        ],
        date: audit.createdAt.toISOString(),
      });
    }
  }

  // ── Search execution traces ─────────────────────────────────────────────────
  if (requestedTypes.includes('trace')) {
    const traceWhere: Record<string, unknown> = {
      OR: [
        { decisionCode: { contains: q, mode: 'insensitive' } },
        { roleKey: { contains: q, mode: 'insensitive' } },
        { finalOutput: { contains: q, mode: 'insensitive' } },
      ],
    };
    if (since || until) {
      const df: Record<string, Date> = {};
      if (since) df['gte'] = since;
      if (until) df['lte'] = until;
      traceWhere['createdAt'] = df;
    }

    const traces = await prisma.executionTrace.findMany({
      where: traceWhere,
      orderBy: { createdAt: 'desc' },
      take: Math.ceil(limit * 0.1),
      select: {
        id: true, roleKey: true, decisionCode: true, riskScore: true,
        createdAt: true, taskId: true, agentRunId: true,
      },
    });

    for (const trace of traces) {
      results.push({
        id: trace.id,
        type: 'trace',
        title: `Trace: ${trace.roleKey ?? 'unknown'} — ${trace.decisionCode ?? 'no decision'}`,
        subtitle: `Risk: ${trace.riskScore != null ? (trace.riskScore * 100).toFixed(0) + '%' : 'n/a'}`,
        url: trace.taskId ? `/tasks/${trace.taskId}/trace` : '/audit',
        excerpt: `Decision: ${trace.decisionCode ?? 'none'} · Role: ${trace.roleKey ?? 'unknown'}`,
        citations: [
          { label: 'Decision', value: trace.decisionCode ?? 'none' },
          { label: 'Role', value: trace.roleKey ?? 'unknown' },
          ...(trace.riskScore != null ? [{ label: 'Risk score', value: (trace.riskScore * 100).toFixed(0) + '%' }] : []),
        ],
        date: trace.createdAt.toISOString(),
      });
    }
  }

  // Sort by date descending, then deduplicate by id
  results.sort((a, b) => {
    if (!a.date && !b.date) return 0;
    if (!a.date) return 1;
    if (!b.date) return -1;
    return b.date.localeCompare(a.date);
  });

  const seen = new Set<string>();
  const deduped = results.filter((r) => {
    if (seen.has(r.id)) return false;
    seen.add(r.id);
    return true;
  });

  const page = deduped.slice(0, limit);

  // Optional LLM summary — only when feature flag is true AND caller requested it
  let llmSummary: string | undefined;
  if (wantLlm && isLlmSummaryEnabled() && page.length > 0) {
    try {
      llmSummary = await generateLlmSummary(q, page);
    } catch {
      // Fail gracefully — deterministic results still returned
    }
  }

  return NextResponse.json({
    results: page,
    total: deduped.length,
    query: q,
    intent,
    ...(llmSummary ? { llmSummary } : {}),
  });
}
