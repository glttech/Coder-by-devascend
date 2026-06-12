import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { writeAudit } from '@/lib/audit';
import { getCurrentUser } from '@/lib/session';

export async function POST(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const currentUser = await getCurrentUser();
  const { id } = params;

  try {
    const source = await prisma.task.findUnique({ where: { id } });
    if (!source) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    const clone = await prisma.task.create({
      data: {
        title: `Copy of ${source.title}`.slice(0, 500),
        instruction: source.instruction,
        agentTool: source.agentTool,
        riskLevel: source.riskLevel,
        environment: source.environment,
        approvalRequired: source.approvalRequired,
        projectId: source.projectId,
      },
    });

    await writeAudit({
      taskId: clone.id,
      event: 'task_cloned',
      details: JSON.stringify({ sourceTaskId: id, at: new Date().toISOString() }),
      userId: currentUser?.userId ?? null,
    });

    return NextResponse.json(clone, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to clone task' }, { status: 500 });
  }
}
