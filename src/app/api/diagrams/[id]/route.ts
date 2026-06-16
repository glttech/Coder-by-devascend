import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const diagram = await prisma.diagram.findUnique({ where: { id: params.id } });
    if (!diagram) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ diagram });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch diagram' }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    await prisma.diagram.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Failed to delete diagram' }, { status: 500 });
  }
}
