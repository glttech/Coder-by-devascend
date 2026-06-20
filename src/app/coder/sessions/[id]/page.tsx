import { notFound } from 'next/navigation';
import Link from 'next/link';
import prisma from '@/lib/prisma';
import { PageHeader } from '@/components/ui/PageHeader';
import LogViewer from './LogViewer';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: { id: string };
}

export default async function SessionDetailPage({ params }: PageProps) {
  const session = await prisma.cliSession.findUnique({
    where: { id: params.id },
    include: {
      task: { select: { id: true, title: true, projectId: true } },
    },
  });

  if (!session) notFound();

  // Serialise Prisma model to a plain object for the client component.
  const initial = {
    id: session.id,
    command: session.command,
    workingDir: session.workingDir,
    status: session.status,
    exitCode: session.exitCode,
    logLines: session.logLines as { ts: string; line: string }[] | null,
    startedAt: session.startedAt?.toISOString() ?? null,
    completedAt: session.completedAt?.toISOString() ?? null,
    createdAt: session.createdAt.toISOString(),
    task: session.task,
  };

  const title = `Session ${session.id.slice(0, 8)}`;
  const subtitle = `Created ${session.createdAt.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <Link href="/coder/sessions" style={{ fontSize: 13, color: 'var(--blue)' }}>
          ← All Sessions
        </Link>
      </div>

      <PageHeader title={title} subtitle={subtitle} />

      <LogViewer sessionId={session.id} initial={initial} />
    </div>
  );
}
