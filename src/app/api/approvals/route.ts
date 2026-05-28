import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// POST /api/approvals – create or update an approval record for a task.
// Body: { taskId: string, approved: boolean }
export async function POST(request: Request) {
  const data = await request.json();
  const { taskId, approved } = data;
  if (!taskId || typeof approved !== 'boolean') {
    return new NextResponse(JSON.stringify({ error: 'Missing required fields' }), { status: 400 });
  }
  try {
    // Upsert approval record
    const approval = await prisma.approval.upsert({
      where: { taskId },
      update: { approved },
      create: { taskId, approved },
    });
    // Task status is not changed by approval — approval state is tracked via the Approval model.
    return NextResponse.json(approval, { status: 200 });
  } catch (err) {
    console.error(err);
    return new NextResponse(JSON.stringify({ error: 'Failed to update approval' }), { status: 500 });
  }
}