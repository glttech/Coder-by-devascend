import { cookies } from 'next/headers';
import { getIronSession } from 'iron-session';
import { getSessionOptions } from '@/lib/session';
import prisma from '@/lib/prisma';
import { redirect } from 'next/navigation';

export default async function TeamPage() {
  const session = await getIronSession<{ userId?: string }>(await cookies(), getSessionOptions());
  if (!session.userId) redirect('/login');

  const members = await prisma.membership.findMany({ where: { orgId: 'org_default' }, orderBy: { createdAt: 'asc' } });

  return (
    <main id="main-content" role="main" style={{ padding: '24px' }}>
      <h1>Team Members</h1>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid var(--border)' }}>User ID</th>
            <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid var(--border)' }}>Role</th>
            <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid var(--border)' }}>Joined</th>
          </tr>
        </thead>
        <tbody>
          {members.map(m => (
            <tr key={m.id}>
              <td style={{ padding: '8px', borderBottom: '1px solid var(--border)' }}>{m.userId}</td>
              <td style={{ padding: '8px', borderBottom: '1px solid var(--border)' }}><span style={{ background: 'var(--blue)', color: '#fff', borderRadius: 4, padding: '2px 6px', fontSize: 12 }}>{m.role}</span></td>
              <td style={{ padding: '8px', borderBottom: '1px solid var(--border)' }}>{new Date(m.createdAt).toLocaleDateString()}</td>
            </tr>
          ))}
          {members.length === 0 && <tr><td colSpan={3} style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)' }}>No members yet.</td></tr>}
        </tbody>
      </table>
    </main>
  );
}
