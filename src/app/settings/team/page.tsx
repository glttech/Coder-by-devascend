import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';
import { redirect } from 'next/navigation';
import { DEFAULT_ORG_ID } from '@/lib/orgScope';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';

export const dynamic = 'force-dynamic';

export default async function TeamSettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const members = await prisma.membership.findMany({
    where: { orgId: DEFAULT_ORG_ID },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: 'asc' },
  });

  return (
    <div>
      <PageHeader title="Team" subtitle="Members in your organization" />
      <div className="section">
        <Card>
          {members.length === 0 ? (
            <EmptyState icon="👥" title="No members yet" description="Invite team members to collaborate." />
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr><th>Name</th><th>Email</th><th>Role</th><th>Joined</th></tr>
                </thead>
                <tbody>
                  {members.map(m => (
                    <tr key={m.id}>
                      <td>{m.user.name ?? '—'}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{m.user.email}</td>
                      <td><span className="badge badge-neutral">{m.role}</span></td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{m.createdAt.toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
