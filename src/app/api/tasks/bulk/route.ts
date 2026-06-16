import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';
import { requireRole } from '@/lib/rbac';

type BulkAction = 'status' | 'delete' | 'priority';

const VALID_STATUSES = ['pending', 'running', 'completed', 'failed', 'cancelled'];
const VALID_PRIORITIES = ['low', 'medium', 'high', 'critical'];

export async function POST(req: Request) {
  const user = await getCurrentUser();
  const check = requireRole(user, 'any');
  if (!check.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: check.status });

  const body = await req.json() as { ids: string[]; action: BulkAction; value?: string };
  const { ids, action, value } = body;

  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'ids required' }, { status: 400 });
  }
  if (ids.length > 100) {
    return NextResponse.json({ error: 'Max 100 items per bulk operation' }, { status: 400 });
  }
  if (!action) {
    return NextResponse.json({ error: 'action required' }, { status: 400 });
  }

  let affected = 0;

  if (action === 'status') {
    if (!value || !VALID_STATUSES.includes(value)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }
    const result = await prisma.task.updateMany({
      where: { id: { in: ids } },
      data: { status: value },
    });
    affected = result.count;
    await prisma.auditLog.create({
      data: {
        event: 'task.bulk_status',
        details: `Set ${affected} tasks to ${value}`,
      },
    });
  } else if (action === 'priority') {
    if (!value || !VALID_PRIORITIES.includes(value)) {
      return NextResponse.json({ error: 'Invalid priority' }, { status: 400 });
    }
    const result = await prisma.task.updateMany({
      where: { id: { in: ids } },
      data: { priority: value },
    });
    affected = result.count;
    await prisma.auditLog.create({
      data: {
        event: 'task.bulk_priority',
        details: `Set ${affected} tasks priority to ${value}`,
      },
    });
  } else if (action === 'delete') {
    const adminCheck = requireRole(user, 'admin');
    if (!adminCheck.ok) return NextResponse.json({ error: 'Admin required for bulk delete' }, { status: 403 });
    const result = await prisma.task.deleteMany({
      where: { id: { in: ids } },
    });
    affected = result.count;
    await prisma.auditLog.create({
      data: {
        event: 'task.bulk_delete',
        details: `Deleted ${affected} tasks`,
      },
    });
  } else {
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }

  return NextResponse.json({ affected });
}
