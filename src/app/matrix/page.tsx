import prisma from '@/lib/prisma';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import {
  COMPETITORS,
  STATUS_CONFIG,
  buildMatrix,
  MatrixStatus,
} from '@/lib/competitiveMatrix';
import { getCurrentUser } from '@/lib/session';
import { requireRole } from '@/lib/rbac';
import MatrixCell from './MatrixCell';

export const dynamic = 'force-dynamic';

export default async function CompetitiveMatrixPage() {
  const user = await getCurrentUser();
  const auth = requireRole(user, 'any');
  const isAdmin = auth.ok && 'role' in auth.user && (auth.user as { role?: string }).role === 'admin';

  const records = await prisma.competitorFeature.findMany({
    orderBy: [{ competitor: 'asc' }, { featureKey: 'asc' }],
  });

  const matrix = buildMatrix(records);

  // Score: count 'yes' per competitor (for summary row)
  const scores = Object.fromEntries(
    COMPETITORS.map((c) => [
      c,
      matrix.filter((r) => r.cells[c]?.status === 'yes').length,
    ]),
  );

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 16px 48px' }}>
      <PageHeader
        title="Competitive Feature Matrix"
        subtitle="Coder vs. the AI-dev ecosystem — click any cell to update (admin only)"
        actions={<Link href="/radar" className="btn btn-secondary btn-sm">Feature Radar</Link>}
      />

      {isAdmin && (
        <div style={{
          fontSize: '0.72rem', color: 'var(--text-muted)',
          marginBottom: 12, padding: '6px 10px',
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6,
        }}>
          Admin mode — click any cell to edit its status and notes.
        </div>
      )}

      {/* Legend */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        {(['yes', 'partial', 'no', 'unknown'] as MatrixStatus[]).map((s) => {
          const cfg = STATUS_CONFIG[s];
          return (
            <span key={s} style={{
              fontSize: '0.72rem', padding: '2px 10px', borderRadius: 10,
              background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}`,
            }}>
              {cfg.label}
            </span>
          );
        })}
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{
          width: '100%', borderCollapse: 'collapse',
          fontSize: '0.78rem', border: '1px solid var(--border)',
          borderRadius: 8, overflow: 'hidden',
        }}>
          <thead>
            <tr style={{ background: 'var(--surface-2)' }}>
              <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--text)', borderBottom: '1px solid var(--border)', minWidth: 160 }}>
                Feature
              </th>
              {COMPETITORS.map((c) => (
                <th key={c} style={{
                  padding: '10px 8px', textAlign: 'center', fontWeight: 600,
                  color: c === 'Coder' ? 'var(--blue)' : 'var(--text)',
                  borderBottom: '1px solid var(--border)',
                  background: c === 'Coder' ? 'color-mix(in srgb, var(--blue) 6%, transparent)' : undefined,
                  minWidth: 110,
                  whiteSpace: 'nowrap',
                }}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.map((row, i) => (
              <tr
                key={row.featureKey}
                style={{ background: i % 2 === 0 ? 'var(--surface)' : 'var(--surface-2)' }}
              >
                <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ fontWeight: 500, color: 'var(--text)' }}>{row.featureLabel}</div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 2 }}>
                    {row.featureDescription}
                  </div>
                </td>
                {COMPETITORS.map((c) => {
                  const cell = row.cells[c] ?? { status: 'unknown' as MatrixStatus, notes: null };
                  return (
                    <MatrixCell
                      key={c}
                      competitor={c}
                      featureKey={row.featureKey}
                      status={cell.status}
                      notes={cell.notes}
                      isAdmin={isAdmin}
                    />
                  );
                })}
              </tr>
            ))}

            {/* Score row */}
            <tr style={{ background: 'var(--surface-2)', borderTop: '2px solid var(--border)' }}>
              <td style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--text)' }}>
                Score (yes)
              </td>
              {COMPETITORS.map((c) => (
                <td key={c} style={{
                  padding: '10px 8px', textAlign: 'center',
                  fontWeight: 700,
                  color: c === 'Coder' ? 'var(--blue)' : 'var(--text)',
                  background: c === 'Coder' ? 'color-mix(in srgb, var(--blue) 6%, transparent)' : undefined,
                }}>
                  {scores[c]} / {matrix.length}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 16, fontSize: '0.72rem', color: 'var(--text-muted)' }}>
        Use <code style={{ fontSize: '0.7rem' }}>POST /api/competitor-features</code> to update cells programmatically.
        Source data is manually curated — verify against vendor documentation before publishing.
      </div>
    </div>
  );
}
