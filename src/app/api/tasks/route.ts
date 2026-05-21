import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// GET /api/tasks – return a list of tasks in descending creation order.
export async function GET() {
  try {
    const tasks = await prisma.task.findMany({
      orderBy: { createdAt: 'desc' },
      include: { project: true, approval: true },
    });
    return NextResponse.json(tasks);
  } catch (err) {
    return new NextResponse(JSON.stringify({ error: 'Failed to fetch tasks' }), { status: 500 });
  }
}

// POST /api/tasks – create a new task.  Expects a JSON body matching the
// Task model fields (except id, status and timestamps).  Returns the
// created task.
export async function POST(request: Request) {
  const data = await request.json();
  try {
    const {
      title,
      instruction,
      projectId,
      agentTool,
      riskLevel,
      environment,
      approvalRequired,
    } = data;

    // Determine which project to associate with the task.  If a projectId is
    // provided, use it directly.  Otherwise, find or create a default project.
    let finalProjectId: string;
    if (projectId) {
      finalProjectId = projectId;
    } else {
      // Look for an existing project to reuse.  Use the first project if
      // available; otherwise create a new "Default Project".
      const existing = await prisma.project.findFirst();
      if (existing) {
        finalProjectId = existing.id;
      } else {
        const created = await prisma.project.create({ data: { name: 'Default Project' } });
        finalProjectId = created.id;
      }
    }

    const task = await prisma.task.create({
      data: {
        title,
        instruction,
        projectId: finalProjectId,
        agentTool,
        riskLevel,
        environment,
        approvalRequired,
      },
    });
    return NextResponse.json(task, { status: 201 });
  } catch (err) {
    console.error(err);
    return new NextResponse(JSON.stringify({ error: 'Failed to create task' }), { status: 500 });
  }
}