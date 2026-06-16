import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { parsePageParams, buildPageResult } from '@/lib/pagination';

const VALID_RISK_LEVELS = ['low', 'medium', 'high'];
const VALID_ENVIRONMENTS = ['local', 'dev', 'staging', 'production'];
const VALID_AGENT_TOOLS = ['open-swe', 'claude-code-manual', 'codex-manual', 'openclaw-manual'];

// GET /api/tasks – return a paginated list of tasks.
// Supports ?limit=&cursor=&order= query params.
export async function GET(request: NextRequest) {
  try {
    const { take, cursor, order } = parsePageParams(request.nextUrl.searchParams);
    const tasks = await prisma.task.findMany({
      orderBy: { createdAt: order },
      take: take + 1, // fetch one extra to determine if there is a next page
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: { project: true, approval: true },
    });
    const page = buildPageResult(tasks, take);
    return NextResponse.json(page);
  } catch (err) {
    return new NextResponse(JSON.stringify({ error: 'Failed to fetch tasks' }), { status: 500 });
  }
}

// POST /api/tasks – create a new task.  Expects a JSON body matching the
// Task model fields (except id, status and timestamps).  Returns the
// created task.
export async function POST(request: Request) {
  const data = await request.json();
  const { title, instruction, projectId, agentTool, riskLevel, environment, approvalRequired } = data;

  const errors: string[] = [];
  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    errors.push('title is required');
  } else if (title.length > 500) {
    errors.push('title must be 500 characters or fewer');
  }
  if (!instruction || typeof instruction !== 'string' || instruction.trim().length === 0) {
    errors.push('instruction is required');
  } else if (instruction.length > 50_000) {
    errors.push('instruction must be 50,000 characters or fewer');
  }
  if (!agentTool || !VALID_AGENT_TOOLS.includes(agentTool)) {
    errors.push(`agentTool must be one of: ${VALID_AGENT_TOOLS.join(', ')}`);
  }
  if (!riskLevel || !VALID_RISK_LEVELS.includes(riskLevel)) {
    errors.push(`riskLevel must be one of: ${VALID_RISK_LEVELS.join(', ')}`);
  }
  if (!environment || !VALID_ENVIRONMENTS.includes(environment)) {
    errors.push(`environment must be one of: ${VALID_ENVIRONMENTS.join(', ')}`);
  }
  if (typeof approvalRequired !== 'boolean') {
    errors.push('approvalRequired must be a boolean');
  }
  if (errors.length > 0) {
    return new NextResponse(JSON.stringify({ error: errors.join('; ') }), { status: 422 });
  }

  try {
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
        title: title.trim(),
        instruction: instruction.trim(),
        projectId: finalProjectId,
        agentTool,
        riskLevel,
        environment,
        approvalRequired,
      },
    });
    await prisma.auditLog.create({
      data: {
        taskId: task.id,
        event: 'task_created',
        details: JSON.stringify({ agentTool, riskLevel, environment, approvalRequired, at: new Date().toISOString() }),
      },
    });
    return NextResponse.json(task, { status: 201 });
  } catch (err) {
    console.error(err);
    return new NextResponse(JSON.stringify({ error: 'Failed to create task' }), { status: 500 });
  }
}
