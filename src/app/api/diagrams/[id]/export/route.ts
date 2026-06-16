import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';
import { requireRole } from '@/lib/rbac';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  const check = requireRole(user, 'any');
  if (!check.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: check.status });

  const diagram = await prisma.diagram.findUnique({ where: { id: params.id } });
  if (!diagram) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // If we have pre-rendered SVG, serve it directly
  if (diagram.svg) {
    return new NextResponse(diagram.svg, {
      status: 200,
      headers: {
        'Content-Type': 'image/svg+xml; charset=utf-8',
        'Content-Disposition': `attachment; filename="diagram-${diagram.id.slice(0, 8)}.svg"`,
        'Cache-Control': 'private, max-age=300',
      },
    });
  }

  // Otherwise return the Mermaid source as plain text for client-side rendering
  return new NextResponse(diagram.source, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': `attachment; filename="diagram-${diagram.id.slice(0, 8)}.mmd"`,
    },
  });
}
