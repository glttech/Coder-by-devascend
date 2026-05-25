import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET /api/instructions/[id] — return instruction details with linked task context.
export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const instruction = await prisma.instruction.findUnique({
      where: { id: params.id },
      include: {
        task: {
          select: {
            id: true,
            title: true,
            status: true,
            riskLevel: true,
            environment: true,
            agentTool: true,
          },
        },
      },
    });

    if (!instruction) {
      return NextResponse.json({ error: 'Instruction not found' }, { status: 404 });
    }

    return NextResponse.json({ instruction });
  } catch (err) {
    console.error('[instructions GET]', err);
    return NextResponse.json({ error: 'Failed to fetch instruction' }, { status: 500 });
  }
}
