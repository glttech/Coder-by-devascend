/**
 * /showcase — Product showcase and feature highlights.
 *
 * A product walkthrough page for prospective customers.
 * No auth required — public page.
 */
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';

const FEATURE_HIGHLIGHTS = [
  {
    icon: '⬟',
    title: 'Repository Intelligence',
    description:
      'Import PR history from any GitHub repository. PRs are automatically classified by type, risk level, and CI status so you always know what shipped.',
    href: '/projects',
  },
  {
    icon: '◎',
    title: 'Governance Timeline',
    description:
      'A unified, chronological view of every change — PR merges, AI agent runs, approvals, and incidents — across all your projects.',
    href: '/audit',
  },
  {
    icon: '◉',
    title: 'Policy Gates',
    description:
      'Every task is automatically evaluated against risk rules before any code ships. Gates can approve, flag for senior review, or block based on environment and risk level.',
    href: '/instructions/pending',
  },
  {
    icon: '⚠',
    title: 'Incident Tracking',
    description:
      'Capture and triage production incidents alongside the AI changes that may have contributed to them. Link incidents to specific agent runs for full traceability.',
    href: '/incidents',
  },
  {
    icon: '◑',
    title: 'Agent Scorecards',
    description:
      'Measure AI agent performance over time. Track pass rates, risk distributions, and approval patterns to improve how your team uses AI tools.',
    href: '/providers/scorecard',
  },
  {
    icon: '◆',
    title: 'Client Reports',
    description:
      'Generate governance reports and diagrams for stakeholders. Export audit trails as PDFs or share read-only links with clients and compliance reviewers.',
    href: '/diagrams',
  },
];

function ResetDemoButton() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  async function handleReset() {
    const confirmed = window.confirm(
      'This will re-seed the database with demo data, replacing any existing records. Continue?',
    );
    if (!confirmed) return;

    setStatus('loading');
    setErrorMsg('');
    try {
      const res = await fetch('/api/demo/reset', { method: 'POST' });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? 'Reset failed');
      }
      setStatus('done');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Reset failed');
      setStatus('error');
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <button
        onClick={handleReset}
        className="btn btn-ghost btn-sm"
        disabled={status === 'loading'}
        style={{ fontSize: 12 }}
      >
        {status === 'loading' ? 'Resetting…' : 'Reset Demo Data'}
      </button>
      {status === 'done' && (
        <span style={{ fontSize: 12, color: 'var(--green)' }}>
          Demo data reset successfully.
        </span>
      )}
      {status === 'error' && (
        <span style={{ fontSize: 12, color: 'var(--red)' }}>{errorMsg}</span>
      )}
    </div>
  );
}

export default function ShowcasePage() {
  return (
    <div>
      <PageHeader
        title="AI Dev Orchestrator — Demo"
        subtitle="Coder by DevAscend gives software teams using AI agents a governance layer that risk-checks, gates, and audits every change before it ships."
        actions={
          <Link href="/getting-started" className="btn btn-primary btn-sm">
            Get Started →
          </Link>
        }
      />

      {/* Hero banner */}
      <div className="section">
        <div
          className="card"
          style={{
            background: 'var(--blue-bg, rgba(59,130,246,0.06))',
            border: '1px solid rgba(59,130,246,0.25)',
            borderBottom: '3px solid var(--blue, rgba(59,130,246,0.6))',
            padding: '24px 28px',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              fontSize: 13,
              color: 'var(--text-secondary)',
              maxWidth: 600,
              margin: '0 auto',
              lineHeight: 1.7,
            }}
          >
            Every AI agent action is recorded, risk-scored, and audited. You stay in control —
            the platform flags anything that needs a human decision before code ships to
            production.
          </div>
          <div style={{ marginTop: 16, display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/demo" className="btn btn-ghost btn-sm">
              Run Live Governance Demo →
            </Link>
            <Link href="/getting-started" className="btn btn-ghost btn-sm">
              View Setup Guide →
            </Link>
          </div>
        </div>
      </div>

      {/* Feature highlights grid */}
      <div className="section">
        <div className="section-header">
          <span className="section-title">Platform Features</span>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 14,
          }}
        >
          {FEATURE_HIGHLIGHTS.map((feature) => (
            <Link
              key={feature.href}
              href={feature.href}
              style={{ textDecoration: 'none' }}
            >
              <div
                className="card"
                style={{
                  padding: '20px 22px',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 20 }}>{feature.icon}</span>
                  <span
                    style={{
                      fontWeight: 600,
                      fontSize: 14,
                      color: 'var(--text)',
                    }}
                  >
                    {feature.title}
                  </span>
                </div>
                <p
                  style={{
                    margin: 0,
                    fontSize: 13,
                    color: 'var(--text-secondary)',
                    lineHeight: 1.6,
                    flex: 1,
                  }}
                >
                  {feature.description}
                </p>
                <div
                  style={{
                    fontSize: 12,
                    color: 'var(--blue)',
                    fontWeight: 500,
                    marginTop: 4,
                  }}
                >
                  Explore →
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* How it works */}
      <div className="section">
        <div className="section-header">
          <span className="section-title">How It Works</span>
        </div>
        <div className="card" style={{ padding: '20px 24px' }}>
          <div className="explainer-steps">
            {[
              {
                n: '1',
                title: 'Connect a repository',
                desc: 'Link your GitHub repo and import PR history to build a baseline of your team\'s change patterns.',
              },
              {
                n: '2',
                title: 'Create AI tasks',
                desc: 'Describe what you want the AI to do. The platform generates a structured prompt you can paste into any AI tool.',
              },
              {
                n: '3',
                title: 'Record the agent response',
                desc: 'Paste the AI\'s output back. Risk analysis runs automatically against your policy gates.',
              },
              {
                n: '4',
                title: 'Get a safety decision',
                desc: 'See a clear CONTINUE / VALIDATE / BLOCK recommendation with full audit trail — before anything ships.',
              },
            ].map(({ n, title, desc }) => (
              <div key={n} className="explainer-step">
                <div className="explainer-step-num">{n}</div>
                <div>
                  <div className="explainer-step-title">{title}</div>
                  <div className="explainer-step-desc">{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="section">
        <div
          className="card"
          style={{
            padding: '28px 32px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 16,
          }}
        >
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: 'var(--text)' }}>
            Ready to start?
          </h2>
          <p
            style={{
              margin: 0,
              fontSize: 13,
              color: 'var(--text-secondary)',
              maxWidth: 420,
              lineHeight: 1.6,
            }}
          >
            Create your first project and see how Coder by DevAscend brings governance to
            your AI-assisted development workflow.
          </p>
          <Link href="/projects/new" className="btn btn-primary">
            Create your first project →
          </Link>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            Already have data?{' '}
            <Link href="/demo" style={{ color: 'var(--blue)' }}>
              Run the live governance demo →
            </Link>
          </div>
        </div>
      </div>

      {/* Reset demo data (non-production only) */}
      {process.env.NODE_ENV !== 'production' && (
        <div className="section">
          <div
            style={{
              padding: '12px 16px',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'rgba(0,0,0,0.02)',
              fontSize: 12,
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <span>Developer tools:</span>
            <ResetDemoButton />
          </div>
        </div>
      )}
    </div>
  );
}
