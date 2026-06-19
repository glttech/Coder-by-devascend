/**
 * GET /api/tasks/[id]/sandbox-replay
 *
 * Returns structured sandbox replay data for a task.
 * Auth: any authenticated user.
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';
import { requireRole } from '@/lib/rbac';
import { featureFlags } from '@/lib/featureFlags';

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const currentUser = await getCurrentUser();
  const auth = requireRole(currentUser, 'any');
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.status === 401 ? 'Unauthorized' : 'Forbidden' },
      { status: auth.status },
    );
  }

  const task = await prisma.task.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      title: true,
      approval: {
        select: {
          approved: true,
          approverId: true,
        },
      },
    },
  });

  if (!task) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  }

  const latestRun = await prisma.agentRun.findFirst({
    where: { taskId: params.id, sandboxPlan: { not: null } },
    orderBy: { startedAt: 'desc' },
    select: {
      id: true,
      sandboxPlan: true,
      response: true,
      filesChanged: true,
      commandsRun: true,
      testResult: true,
      commitHash: true,
      riskScore: true,
      status: true,
    },
  });

  const approvalStatus = task.approval
    ? task.approval.approved === true
      ? 'approved'
      : task.approval.approved === false
      ? 'rejected'
      : 'pending'
    : null;

  return NextResponse.json({
    taskId: params.id,
    sandboxEnabled: featureFlags.sandboxMode,
    latestRun: latestRun
      ? {
          sandboxPlan: latestRun.sandboxPlan,
          response: latestRun.response,
          filesChanged: latestRun.filesChanged,
          commandsRun: latestRun.commandsRun,
          testResult: latestRun.testResult,
          commitHash: latestRun.commitHash,
          riskScore: latestRun.riskScore,
          status: latestRun.status,
        }
      : null,
    approvalStatus,
  });
}
