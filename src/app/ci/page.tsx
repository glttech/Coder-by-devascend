import CiStatusGrid from '@/components/CiStatusGrid';

export const dynamic = 'force-dynamic';

export default function CiPage() {
  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>CI/CD Dashboard</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>CI status across all projects with tracked GitHub PRs</p>
      </div>
      <CiStatusGrid />
    </div>
  );
}
