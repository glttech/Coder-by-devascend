import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { writeAudit } from '@/lib/audit';
import { getCurrentUser } from '@/lib/session';
import { requireRole } from '@/lib/rbac';

const VALID_RISK_LEVELS = ['low', 'medium', 'high'];
const VALID_ENVIRONMENTS = ['local', 'dev', 'staging', 'production'];
const VALID_AGENT_TOOLS = ['open-swe', 'claude-code-manual', 'codex-manual', 'openclaw-manual'];
const VALID_PRIORITIES = ['low', 'medium', 'high', 'critical'];

// GET /api/tasks – return a list of tasks in descending creation order.
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

// POST /api/tasks – create a new task.  Expects a JSON body matching the
// Task model fields (except id, status and timestamps).  Returns the
// created task.
export async function POST(request: Request) {
  const currentUser = await getCurrentUser();
  const roleCheck = requireRole(currentUser, 'admin');
  if (!roleCheck.ok) {
    return NextResponse.json({ error: roleCheck.status === 401 ? 'Unauthorized' : 'Forbidden' }, { status: roleCheck.status });
  }

  const data = await request.json();
  const { title, instruction, projectId, agentTool, riskLevel, environment, approvalRequired, priority, dueDate, milestoneId } = data;

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
  if (priority !== undefined && !VALID_PRIORITIES.includes(priority)) {
    errors.push(`priority must be one of: ${VALID_PRIORITIES.join(', ')}`);
  }
  if (dueDate !== undefined && dueDate !== null) {
    const parsed = new Date(dueDate);
    if (isNaN(parsed.getTime())) {
      errors.push('dueDate must be a valid ISO date string');
    }
  }
  if (errors.length > 0) {
    return new NextResponse(JSON.stringify({ error: errors.join('; ') }), { status: 422 });
  }

  try {
    // Evaluate policy gates
    const { evaluatePolicy } = await import('@/lib/policyGates');
    const policyResult = evaluatePolicy({ title, instruction, riskLevel, environment });
    // If blocked or requires approval, force approvalRequired = true
    const effectiveApprovalRequired = approvalRequired || policyResult.requiresApproval || policyResult.blocked;

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
        approvalRequired: effectiveApprovalRequired,
        ...(priority !== undefined ? { priority } : {}),
        ...(dueDate !== undefined && dueDate !== null ? { dueDate: new Date(dueDate) } : {}),
        ...(milestoneId !== undefined && milestoneId !== null ? { milestoneId } : {}),
      },
    });
    await writeAudit({
      taskId: task.id,
      event: 'task_created',
      details: JSON.stringify({ agentTool, riskLevel, environment, approvalRequired: effectiveApprovalRequired, at: new Date().toISOString() }),
      userId: currentUser?.userId ?? null,
    });
    return NextResponse.json({ ...task, policyEvaluation: policyResult }, { status: 201 });
  } catch (err) {
    console.error(err);
    return new NextResponse(JSON.stringify({ error: 'Failed to create task' }), { status: 500 });
  }
}
