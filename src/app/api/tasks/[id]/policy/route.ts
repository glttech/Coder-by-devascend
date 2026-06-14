import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';
import { requireRole } from '@/lib/rbac';
import { evaluatePolicy } from '@/lib/policyGates';

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

  const task = await prisma.task.findUnique({
    where: { id: params.id },
    select: { title: true, instruction: true, riskLevel: true, environment: true },
  });
  if (!task) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  }

  const result = evaluatePolicy(task);
  return NextResponse.json(result);
}
