import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { aggregateProjectCi } from '@/lib/ci/aggregate';

export const dynamic = 'force-dynamic';

export async function GET() {
  const projects = await prisma.project.findMany({
    select: { id: true, name: true },
  });

  const results = await Promise.all(
    projects.map(async (project) => {
      const prs = await prisma.githubPR.findMany({
        where: { projectId: project.id },
        select: { id: true, projectId: true, prNumber: true, title: true, ciStatus: true, state: true, merged: true, prUrl: true },
        orderBy: { importedAt: 'desc' },
        take: 50,
      });
      return aggregateProjectCi(project.name, project.id, prs);
    })
  );

  const overall = {
    red: results.filter(r => r.signal === 'red').length,
    yellow: results.filter(r => r.signal === 'yellow').length,
    green: results.filter(r => r.signal === 'green').length,
    none: results.filter(r => r.signal === 'none').length,
  };

  return NextResponse.json({ projects: results, overall, generatedAt: new Date().toISOString() });
}
