/**
 * /getting-started — Onboarding guide.
 *
 * Static server component — no auth required.
 * Walks new users through the 5 key steps to get value from the platform.
 */

import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';

export const metadata = {
  title: 'Getting Started — Coder by DevAscend',
  description: 'Step-by-step guide to setting up AI-assisted development governance.',
};

const STEPS = [
  {
    number: 1,
    title: 'Create a Project',
    description:
      'Connect a GitHub repository by providing the repo owner and name. This lets the platform track pull requests, CI status, and code changes for that repository.',
    action: { label: 'Create a Project →', href: '/projects/new' },
  },
  {
    number: 2,
    title: 'Import PR History',
    description:
      'Open your project page and click the "Import PR History" button to sync all existing pull requests. This gives the governance timeline a full picture of past changes and establishes a baseline for risk analysis.',
    action: null,
  },
  {
    number: 3,
    title: 'Create a Task',
    description:
      'Describe the work you want an AI agent to do. Set a risk level (low / medium / high) and pick the target environment. Policy gates will automatically evaluate whether the task is safe to proceed.',
    action: { label: 'Create a Task →', href: '/tasks/new' },
  },
  {
    number: 4,
    title: 'Run an Agent',
    description:
      'From the task detail page, use the Orchestration Console to generate a structured prompt. Paste that prompt into Claude, Codex, or any AI tool. Then paste the agent\'s output back into the console to record the response and trigger risk evaluation.',
    action: null,
  },
  {
    number: 5,
    title: 'Review Governance',
    description:
      'Every agent run produces a risk score, a policy decision, and a full audit trail. Review the results in the Governance Timeline, check the Intelligence Dashboard for patterns across projects, and export an Audit Log for stakeholders.',
    action: null,
    links: [
      { label: 'Governance Timeline', href: '/tasks' },
      { label: 'Intelligence Dashboard', href: '/providers/scorecard' },
      { label: 'Audit Log', href: '/audit' },
    ],
  },
];

const CONCEPTS = [
  {
    term: 'Project',
    definition:
      'A GitHub repository you have connected to the platform. Projects group tasks, PRs, and agent runs together.',
  },
  {
    term: 'Task',
    definition:
      'A unit of AI-assisted work. Each task has a title, description, risk level, and environment. Tasks progress through a lifecycle from draft → in_progress → review → completed.',
  },
  {
    term: 'Agent Run',
    definition:
      'A single exchange with an AI agent: the generated prompt and the agent\'s response. Runs are recorded and evaluated for risk automatically.',
  },
  {
    term: 'Policy Gate',
    definition:
      'An automatic risk check that runs on every task. Gates can approve, flag for senior review, or block a task based on configurable risk rules.',
  },
  {
    term: 'Governance Timeline',
    definition:
      'A unified, chronological view of all changes — PR merges, agent runs, approvals, and incidents — for a project or across the whole platform.',
  },
];

export default function GettingStartedPage() {
  return (
    <div>
      <PageHeader
        title="Getting Started"
        subtitle="Follow these five steps to set up AI-assisted development governance for your team."
        actions={
          <Link href="/demo" className="btn btn-ghost btn-sm">
            View Demo →
          </Link>
        }
      />

      {/* Steps */}
      <div className="section">
        <div className="section-header">
          <span className="section-title">Setup Steps</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {STEPS.map((step) => (
            <div key={step.number} className="card" style={{ padding: '20px 24px' }}>
              <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                {/* Step number badge */}
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    background: 'var(--blue)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: 15,
                    flexShrink: 0,
                    marginTop: 2,
                  }}
                >
                  {step.number}
                </div>

                {/* Content */}
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontWeight: 600,
                      fontSize: 15,
                      marginBottom: 6,
                      color: 'var(--text)',
                    }}
                  >
                    {step.title}
                  </div>
                  <p
                    style={{
                      fontSize: 13,
                      color: 'var(--text-secondary)',
                      margin: 0,
                      lineHeight: 1.6,
                    }}
                  >
                    {step.description}
                  </p>

                  {/* Optional action link */}
                  {step.action && (
                    <div style={{ marginTop: 10 }}>
                      <Link
                        href={step.action.href}
                        className="btn btn-primary btn-sm"
                      >
                        {step.action.label}
                      </Link>
                    </div>
                  )}

                  {/* Optional multiple links */}
                  {step.links && (
                    <div style={{ marginTop: 10, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      {step.links.map((link) => (
                        <Link
                          key={link.href}
                          href={link.href}
                          style={{ color: 'var(--blue)', fontSize: 13, fontWeight: 500 }}
                        >
                          {link.label} →
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Key Concepts */}
      <div className="section">
        <div className="section-header">
          <span className="section-title">Key Concepts</span>
        </div>
        <div className="card" style={{ padding: '20px 24px' }}>
          <dl style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {CONCEPTS.map((concept) => (
              <div key={concept.term}>
                <dt
                  style={{
                    fontWeight: 600,
                    fontSize: 13,
                    color: 'var(--text)',
                    marginBottom: 3,
                  }}
                >
                  {concept.term}
                </dt>
                <dd
                  style={{
                    margin: 0,
                    fontSize: 13,
                    color: 'var(--text-secondary)',
                    lineHeight: 1.6,
                  }}
                >
                  {concept.definition}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      {/* Quick links */}
      <div className="section">
        <div className="section-header">
          <span className="section-title">Quick Links</span>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: 10,
          }}
        >
          {[
            { label: 'New Project', href: '/projects/new', icon: '⬟' },
            { label: 'New Task', href: '/tasks/new', icon: '◈' },
            { label: 'Review Queue', href: '/instructions/pending', icon: '◉' },
            { label: 'Audit Log', href: '/audit', icon: '◎' },
            { label: 'Scorecard', href: '/providers/scorecard', icon: '◑' },
            { label: 'Demo Walkthrough', href: '/demo', icon: '▷' },
          ].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="card"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '12px 16px',
                textDecoration: 'none',
                color: 'var(--text)',
                fontSize: 13,
                fontWeight: 500,
                transition: 'border-color 0.15s',
              }}
            >
              <span style={{ fontSize: 16 }}>{link.icon}</span>
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
