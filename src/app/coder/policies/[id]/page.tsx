import { notFound } from 'next/navigation';
import Link from 'next/link';
import prisma from '@/lib/prisma';
import { PageHeader } from '@/components/ui/PageHeader';
import PolicyEditor from './PolicyEditor';

export const dynamic = 'force-dynamic';

interface PageProps { params: { id: string } }

export default async function PolicyDetailPage({ params }: PageProps) {
  const policy = await prisma.commandPolicy.findUnique({ where: { id: params.id } });
  if (!policy) notFound();

  const initial = {
    id: policy.id,
    name: policy.name,
    description: policy.description,
    commandPrefixes: policy.commandPrefixes,
    allowedWorkdirs: policy.allowedWorkdirs,
    scrubLogs: policy.scrubLogs,
    enabled: policy.enabled,
    createdAt: policy.createdAt.toISOString(),
    updatedAt: policy.updatedAt.toISOString(),
  };

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <Link href="/coder/policies" style={{ fontSize: 13, color: 'var(--blue)' }}>← Policies</Link>
      </div>
      <PageHeader
        title={policy.name}
        subtitle={`Created ${policy.createdAt.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`}
      />
      <PolicyEditor initial={initial} />
    </div>
  );
}
