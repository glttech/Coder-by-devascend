import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';
import { requireRole } from '@/lib/rbac';

export const dynamic = 'force-dynamic';

/**
 * GET /api/agent-runs/[id]/link-prs
 * Returns PRs already linked to this agent run, plus up to 5 suggestions for
 * unlinked PRs in the same project scored by SHA match and time proximity.
 * Auth: any authenticated user.
 */
export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const user = await getCurrentUser();
  const auth = requireRole(user, 'any');
  if (!auth.ok) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: auth.status });
  }

  const agentRun = await prisma.agentRun.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      commitHash: true,
      startedAt: true,
      endedAt: true,
      task: { select: { id: true, projectId: true, title: true } },
      githubPRs: {
        select: {
          id: true,
          prNumber: true,
          title: true,
          state: true,
          merged: true,
          ciStatus: true,
          classification: true,
          sourceBranch: true,
          prUrl: true,
        },
      },
    },
  });

  if (!agentRun) {
    return NextResponse.json({ error: 'Agent run not found' }, { status: 404 });
  }

  const { commitHash, startedAt, endedAt, task, githubPRs: linked } = agentRun;
  const projectId = task?.projectId;

  // Compute suggestions from unlinked PRs in the same project
  let suggestions: {
    id: string;
    prNumber: number;
    title: string;
    state: string;
    merged: boolean;
    ciStatus: string | null;
    classification: string | null;
    sourceBranch: string | null;
    prUrl: string | null;
    score: number;
    matchReason: string;
  }[] = [];

  if (projectId) {
    const linkedIds = new Set(linked.map((p) => p.id));
    const runCenter = endedAt ?? startedAt;
    const windowMs = 24 * 60 * 60 * 1000; // 24h

    const candidates = await prisma.githubPR.findMany({
      where: {
        projectId,
        agentRunId: null,
        id: { notIn: [...linkedIds] },
      },
      select: {
        id: true,
        prNumber: true,
        title: true,
        state: true,
        merged: true,
        ciStatus: true,
        classification: true,
        sourceBranch: true,
        mergeSha: true,
        prUrl: true,
        githubCreatedAt: true,
        githubMergedAt: true,
      },
      orderBy: { importedAt: 'desc' },
      take: 100,
    });

    const titleWords = new Set(
      (task?.title ?? '')
        .toLowerCase()
        .split(/[\W_]+/)
        .filter((w) => w.length > 3),
    );

    for (const pr of candidates) {
      let score = 0;
      const reasons: string[] = [];

      // Exact SHA match — highest confidence
      if (commitHash && pr.mergeSha && pr.mergeSha === commitHash) {
        score += 10;
        reasons.push('commit SHA match');
      }

      // Time proximity — PR created/merged within 24h of run
      const prTimestamp = pr.githubMergedAt ?? pr.githubCreatedAt;
      if (prTimestamp) {
        const diffMs = Math.abs(prTimestamp.getTime() - runCenter.getTime());
        if (diffMs < windowMs) {
          const pts = Math.round(5 * (1 - diffMs / windowMs));
          score += pts;
          reasons.push(`within 24h (${Math.round(diffMs / 3600000)}h apart)`);
        }
      }

      // Branch name keywords overlap with task title words
      if (pr.sourceBranch && titleWords.size > 0) {
        const branchWords = pr.sourceBranch.toLowerCase().split(/[-_/]+/);
        const matches = branchWords.filter((w) => titleWords.has(w));
        if (matches.length > 0) {
          score += matches.length * 2;
          reasons.push(`branch keyword match (${matches.slice(0, 2).join(', ')})`);
        }
      }

      if (score > 0) {
        suggestions.push({
          id: pr.id,
          prNumber: pr.prNumber,
          title: pr.title,
          state: pr.state,
          merged: pr.merged,
          ciStatus: pr.ciStatus,
          classification: pr.classification,
          sourceBranch: pr.sourceBranch,
          prUrl: pr.prUrl,
          score,
          matchReason: reasons.join('; '),
        });
      }
    }

    suggestions.sort((a, b) => b.score - a.score);
    suggestions = suggestions.slice(0, 5);
  }

  return NextResponse.json({ linked, suggestions });
}

/**
 * POST /api/agent-runs/[id]/link-prs
 * Body: { prIds: string[] }
 * Sets agentRunId on each given GithubPR (within the same project as the run).
 * Passing an empty array unlinks all currently linked PRs.
 * Auth: admin only.
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  const user = await getCurrentUser();
  const auth = requireRole(user, 'admin');
  if (!auth.ok) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: auth.status });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body || typeof body !== 'object' || !Array.isArray((body as Record<string, unknown>).prIds)) {
    return NextResponse.json({ error: 'prIds must be an array of PR IDs' }, { status: 400 });
  }

  const prIds = (body as { prIds: unknown[] }).prIds;
  if (prIds.some((id) => typeof id !== 'string')) {
    return NextResponse.json({ error: 'All prIds must be strings' }, { status: 400 });
  }

  const agentRun = await prisma.agentRun.findUnique({
    where: { id: params.id },
    select: { id: true, task: { select: { projectId: true } } },
  });
  if (!agentRun) {
    return NextResponse.json({ error: 'Agent run not found' }, { status: 404 });
  }

  const projectId = agentRun.task?.projectId;

  // Unlink any PRs currently linked to this agent run that are not in the new set
  await prisma.githubPR.updateMany({
    where: { agentRunId: params.id, id: { notIn: prIds as string[] } },
    data: { agentRunId: null },
  });

  // Link the new PRs — scoped to the same project for safety
  let linked = 0;
  if ((prIds as string[]).length > 0) {
    const result = await prisma.githubPR.updateMany({
      where: {
        id: { in: prIds as string[] },
        ...(projectId ? { projectId } : {}),
      },
      data: { agentRunId: params.id },
    });
    linked = result.count;
  }

  return NextResponse.json({ linked });
}
