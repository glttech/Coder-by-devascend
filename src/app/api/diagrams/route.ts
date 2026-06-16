import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

const MAX_SOURCE_LENGTH = 50_000;
const VALID_KINDS = ['task_lifecycle', 'architecture', 'dependency'];

// GET /api/diagrams?entityType=task&entityId=xxx
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const entityType = searchParams.get('entityType');
  const entityId = searchParams.get('entityId');

  try {
    const diagrams = await prisma.diagram.findMany({
      where: {
        ...(entityType ? { entityType } : {}),
        ...(entityId ? { entityId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return NextResponse.json({ diagrams });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch diagrams' }, { status: 500 });
  }
}

// POST /api/diagrams — save a diagram
export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as {
    kind?: string;
    title?: string;
    source?: string;
    entityType?: string;
    entityId?: string;
    createdBy?: string;
  } | null;

  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.kind || !body.title || !body.source) {
    return NextResponse.json({ error: 'kind, title, and source are required' }, { status: 400 });
  }
  if (!VALID_KINDS.includes(body.kind)) {
    return NextResponse.json({ error: 'Invalid diagram kind' }, { status: 400 });
  }
  if (body.source.length > MAX_SOURCE_LENGTH) {
    return NextResponse.json({ error: 'Diagram source too large' }, { status: 400 });
  }

  try {
    const diagram = await prisma.diagram.create({
      data: {
        kind: body.kind,
        title: body.title,
        source: body.source,
        entityType: body.entityType ?? null,
        entityId: body.entityId ?? null,
        createdBy: body.createdBy ?? 'system',
      },
    });

    return NextResponse.json({ diagram }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Failed to save diagram' }, { status: 500 });
  }
}
