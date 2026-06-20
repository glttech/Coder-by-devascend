import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';
import { requireRole } from '@/lib/rbac';

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const currentUser = await getCurrentUser();
  const roleCheck = requireRole(currentUser, 'any');
  if (!roleCheck.ok) {
    return NextResponse.json(
      { error: roleCheck.status === 401 ? 'Unauthorized' : 'Forbidden' },
      { status: roleCheck.status },
    );
  }

  try {
    const task = await prisma.task.findUnique({
      where: { id: params.id },
      include: {
        project: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true, email: true } },
        milestone: { select: { id: true, title: true } },
        agentRuns: {
          include: {
            provider: { select: { id: true, name: true, type: true } },
            steps: {
              select: {
                stepIndex: true,
                type: true,
                content: true,
                createdAt: true,
              },
              orderBy: { stepIndex: 'asc' },
            },
            evaluations: {
              select: {
                name: true,
                passed: true,
                score: true,
                reason: true,
              },
            },
          },
          orderBy: { startedAt: 'asc' },
        },
        approval: {
          include: {
            user: { select: { name: true, email: true } },
          },
        },
        audits: {
          include: {
            user: { select: { name: true, email: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    const githubPRs = await prisma.githubPR.findMany({
      where: { taskId: params.id },
      select: {
        prNumber: true,
        title: true,
        state: true,
        merged: true,
        ciStatus: true,
        sourceBranch: true,
        prUrl: true,
        githubCreatedAt: true,
      },
      orderBy: { githubCreatedAt: 'asc' },
    });

    const {
      agentRuns,
      approval,
      audits,
      project,
      assignee,
      milestone,
      ...taskFields
    } = task;

    return NextResponse.json({
      task: {
        id: taskFields.id,
        title: taskFields.title,
        instruction: taskFields.instruction,
        riskLevel: taskFields.riskLevel,
        environment: taskFields.environment,
        approvalRequired: taskFields.approvalRequired,
        status: taskFields.status,
        priority: taskFields.priority,
        dueDate: taskFields.dueDate,
        agentTool: taskFields.agentTool,
        createdAt: taskFields.createdAt,
        updatedAt: taskFields.updatedAt,
        project,
        assignee,
        milestone,
      },
      agentRuns: agentRuns.map((run) => ({
        id: run.id,
        generatedPrompt: run.generatedPrompt,
        selectedTool: run.selectedTool,
        response: run.response,
        filesChanged: run.filesChanged,
        commandsRun: run.commandsRun,
        testResult: run.testResult,
        commitHash: run.commitHash,
        status: run.status,
        startedAt: run.startedAt,
        endedAt: run.endedAt,
        provider: run.provider,
        steps: run.steps,
        evaluations: run.evaluations,
      })),
      approval: approval
        ? {
            approved: approval.approved,
            approverId: approval.approverId,
            approver: approval.user,
            createdAt: approval.createdAt,
            updatedAt: approval.updatedAt,
          }
        : null,
      auditLog: audits.map((log) => ({
        event: log.event,
        details: log.details,
        createdAt: log.createdAt,
        user: log.user,
      })),
      githubPRs,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[tasks evidence GET]', err);
    return NextResponse.json({ error: 'Failed to fetch evidence pack' }, { status: 500 });
  }
}
