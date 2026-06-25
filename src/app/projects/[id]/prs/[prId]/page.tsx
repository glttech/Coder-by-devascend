import prisma from '@/lib/prisma';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { summarisePR } from '@/lib/prSummary';
import { analyzePrImportance, PRIORITY_META, TRIAGE_META, type SignalSeverity } from '@/lib/prIntelligence';
import RefreshPRButton from '@/components/RefreshPRButton';
import { generatePrDiffDiagram } from '@/lib/diagrams/prDiff';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: { id: string; prId: string };
}

const QUALITY_STYLES: Record<string, { color: string; label: string }> = {
  strong:   { color: 'var(--green)',  label: 'Strong' },
  adequate: { color: 'var(--blue)',   label: 'Adequate' },
  weak:     { color: 'var(--amber)',  label: 'Weak' },
  missing:  { color: 'var(--red)',    label: 'Incomplete' },
};

const RISK_COLORS: Record<string, string> = {
  high:    'var(--red)',
  medium:  'var(--amber)',
  low:     'var(--green)',
  unknown: 'var(--text-muted)',
};

const CI_BADGE: Record<string, string> = {
  success: 'badge-success',
  failure: 'badge-sev-high',
  pending: 'badge-neutral',
  neutral: 'badge-neutral',
};

const SEVERITY_COLOR: Record<SignalSeverity, string> = {
  critical: 'var(--red)',
  high: 'var(--amber)',
  medium: 'var(--blue)',
  low: 'var(--text-muted)',
};

export default async function PRDetailPage({ params }: PageProps) {
  const pr = await prisma.githubPR.findUnique({
    where: { id: params.prId },
    include: { project: { select: { id: true, name: true, repoOwner: true, repoName: true } } },
  });

  if (!pr || pr.projectId !== params.id) {
    return (
      <div className="empty-state" style={{ maxWidth: 420 }}>
        <div className="empty-state-icon">✕</div>
        <div className="empty-state-title">PR not found</div>
        <p className="empty-state-description">This imported PR does not exist or belongs to a different project.</p>
      </div>
    );
  }

  const summary = summarisePR(pr.title, pr.body ?? null);
  const qs = QUALITY_STYLES[summary.evidenceQuality] ?? QUALITY_STYLES.missing;
  const intel = analyzePrImportance(pr);
  const pmeta = PRIORITY_META[intel.priority];
  const tmeta = TRIAGE_META[intel.triage];
  const diagram = generatePrDiffDiagram(pr.prNumber, pr.filesChanged);
  const repoUrl = pr.project.repoOwner && pr.project.repoName
    ? `https://github.com/${pr.project.repoOwner}/${pr.project.repoName}`
    : null;

  return (
    <div>
      <PageHeader
        title={`PR #${pr.prNumber}`}
        subtitle={
          <Link href={`/projects/${params.id}`} style={{ fontSize: 12, color: 'var(--blue)' }}>
            ← {pr.project.name}
          </Link>
        }
        badge={
          <span className={`badge badge-${pr.merged ? 'success' : pr.state === 'open' ? 'pending_approval' : 'neutral'}`}>
            {pr.merged ? 'merged' : pr.state}
          </span>
        }
        actions={
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <RefreshPRButton prId={pr.id} />
            {pr.prUrl && (
              <a href={pr.prUrl} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">
                View on GitHub ↗
              </a>
            )}
          </div>
        }
      />

      {/* PR Metadata */}
      <div className="section">
        <div className="card">
          <div className="card-header" style={{ marginBottom: 0, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
            <span className="card-title" style={{ fontSize: 16 }}>{pr.title}</span>
          </div>
          <div className="meta-grid" style={{ marginTop: 12 }}>
            <div className="meta-row">
              <span className="meta-label">Author</span>
              <span className="meta-value" style={{ fontFamily: 'monospace', fontSize: 13 }}>{pr.author ?? '—'}</span>
            </div>
            <div className="meta-row">
              <span className="meta-label">Branch</span>
              <span className="meta-value" style={{ fontFamily: 'monospace', fontSize: 13 }}>
                {pr.sourceBranch ?? '—'} → {pr.baseBranch ?? '—'}
              </span>
            </div>
            {pr.mergeSha && (
              <div className="meta-row">
                <span className="meta-label">Merge SHA</span>
                <span className="meta-value" style={{ fontFamily: 'monospace', fontSize: 12 }}>{pr.mergeSha.slice(0, 12)}</span>
              </div>
            )}
            <div className="meta-row">
              <span className="meta-label">CI Status</span>
              <span className="meta-value">
                {pr.ciStatus ? (
                  <span className={`badge ${CI_BADGE[pr.ciStatus] ?? 'badge-neutral'}`}>{pr.ciStatus}</span>
                ) : '—'}
              </span>
            </div>
            <div className="meta-row">
              <span className="meta-label">Files changed</span>
              <span className="meta-value">{pr.filesChangedCount ?? pr.filesChanged.length ?? '—'}</span>
            </div>
            {pr.labels.length > 0 && (
              <div className="meta-row">
                <span className="meta-label">Labels</span>
                <span className="meta-value" style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {pr.labels.map((l) => <span key={l} className="badge badge-neutral" style={{ fontSize: 11 }}>{l}</span>)}
                </span>
              </div>
            )}
            {pr.githubMergedAt && (
              <div className="meta-row">
                <span className="meta-label">Merged</span>
                <span className="meta-value" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {new Date(pr.githubMergedAt).toLocaleString()}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* PR Intelligence */}
      <div className="section">
        <div className="section-header">
          <span className="section-title">PR Intelligence</span>
          <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: pmeta.color }} title={`Importance score ${intel.importanceScore}/100`}>
              {pmeta.label} priority
            </span>
            <span className={`badge ${tmeta.badge}`}>{tmeta.label}</span>
          </span>
        </div>
        <div className="card">
          {/* Needs-review / merge-readiness banner */}
          {intel.mergeReadiness.ready ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 6, marginBottom: 14 }}>
              <span style={{ color: 'var(--green)', fontWeight: 700, fontSize: 13 }}>✓ Ready to merge</span>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>CI is green and no blocking risk signals were detected.</span>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: intel.mergeReadiness.blockers.length > 0 ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.08)', border: `1px solid ${intel.mergeReadiness.blockers.length > 0 ? 'rgba(239,68,68,0.3)' : 'rgba(245,158,11,0.3)'}`, borderRadius: 6, marginBottom: 14 }}>
              <span style={{ color: intel.mergeReadiness.blockers.length > 0 ? 'var(--red)' : 'var(--amber)', fontWeight: 700, fontSize: 13 }}>
                {intel.mergeReadiness.blockers.length > 0 ? '⛔ Needs review before merge' : '⚠ Review recommended'}
              </span>
            </div>
          )}

          {/* Risk signals */}
          {intel.signals.length > 0 ? (
            <div style={{ marginBottom: intel.mergeReadiness.blockers.length || intel.mergeReadiness.warnings.length ? 16 : 0 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', marginBottom: 8 }}>
                Risk Signals ({intel.signals.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {intel.signals.map((s) => (
                  <div key={s.key} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <span
                      style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: SEVERITY_COLOR[s.severity], flexShrink: 0, width: 56, paddingTop: 1 }}
                    >
                      {s.severity}
                    </span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{s.label}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 1 }}>{s.evidence}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              No importance signals detected — this PR looks routine.
            </div>
          )}

          {/* Blockers */}
          {intel.mergeReadiness.blockers.length > 0 && (
            <div style={{ marginBottom: intel.mergeReadiness.warnings.length ? 12 : 0 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--red)', marginBottom: 6 }}>
                Blockers
              </div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 2 }}>
                {intel.mergeReadiness.blockers.map((b) => <li key={b}>{b}</li>)}
              </ul>
            </div>
          )}

          {/* Warnings */}
          {intel.mergeReadiness.warnings.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--amber)', marginBottom: 6 }}>
                Before Merge
              </div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 2 }}>
                {intel.mergeReadiness.warnings.map((w) => <li key={w}>{w}</li>)}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Feature Analysis */}
      <div className="section">
        <div className="section-header">
          <span className="section-title">Feature Analysis</span>
          <span style={{ fontSize: 12, color: qs.color, fontWeight: 600 }}>{qs.label}</span>
        </div>
        <div className="card">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', marginBottom: 6 }}>
                What Changed
              </div>
              <div style={{ fontSize: 14, color: 'var(--text)' }}>{summary.whatChanged}</div>
            </div>

            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', marginBottom: 6 }}>
                Why It Matters
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{summary.whyItMatters}</div>
            </div>

            <div style={{ display: 'flex', gap: 24 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', marginBottom: 4 }}>
                  Risk Level
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: RISK_COLORS[summary.riskLevel] }}>
                  {summary.riskLevel.toUpperCase()}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{summary.riskReason}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', marginBottom: 4 }}>
                  Review Quality
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: qs.color }}>{qs.label}</div>
              </div>
            </div>

            {summary.validationEvidence.length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--green)', marginBottom: 6 }}>
                  Validation Checks ✓
                </div>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {summary.validationEvidence.map((e) => <li key={e}>{e}</li>)}
                </ul>
              </div>
            )}

            {summary.missingEvidence.length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--amber)', marginBottom: 6 }}>
                  Missing / Concerns ⚠
                </div>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {summary.missingEvidence.map((m) => <li key={m}>{m}</li>)}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* PR Description */}
      {pr.body && (
        <div className="section">
          <div className="section-header">
            <span className="section-title">PR Description</span>
          </div>
          <div className="card">
            <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0, maxHeight: 400, overflowY: 'auto' }}>
              {pr.body}
            </pre>
          </div>
        </div>
      )}

      {/* Changed Files */}
      {pr.filesChanged.length > 0 && (
        <div className="section">
          <div className="section-header">
            <span className="section-title">Changed Files ({pr.filesChangedCount ?? pr.filesChanged.length})</span>
          </div>
          <div className="card">
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {pr.filesChanged.slice(0, 50).map((f) => (
                <li key={f} style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-secondary)' }}>{f}</li>
              ))}
              {pr.filesChanged.length > 50 && (
                <li style={{ fontSize: 12, color: 'var(--text-muted)' }}>…and {pr.filesChanged.length - 50} more</li>
              )}
            </ul>
          </div>
        </div>
      )}

      {/* File Change Map Diagram */}
      {pr.filesChanged.length > 0 && (
        <div className="section">
          <div className="section-header">
            <span className="section-title">File Change Map</span>
          </div>
          <div className="card">
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>{diagram.title}</p>
            <pre className="prompt-block" style={{ fontSize: 11, overflowX: 'auto' }}>{diagram.source}</pre>
            <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
              Paste the above into{' '}
              <a href="https://mermaid.live" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--blue)' }}>
                mermaid.live
              </a>{' '}
              to render.
            </div>
          </div>
        </div>
      )}

      <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
        Imported {pr.importedAt.toLocaleString()}
        {pr.updatedAt > pr.importedAt && (
          <> · Last refreshed {pr.updatedAt.toLocaleString()}</>
        )}
        {repoUrl && (
          <> · <a href={repoUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--blue)' }}>{pr.project.repoOwner}/{pr.project.repoName}</a></>
        )}
      </div>
    </div>
  );
}
