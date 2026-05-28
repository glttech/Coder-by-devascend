'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DecisionBanner } from '@/components/ui/DecisionBanner';

interface RiskFlagDetail {
  key: string;
  label: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
}

interface MissingEvidenceDetail {
  key: string;
  label: string;
  description: string;
}

interface EnrichedSession {
  id: string;
  currentStep: number;
  agentTool: string | null;
  agentResponse: string | null;
  filesMentioned: string[];
  commandsMentioned: string[];
  validationOutput: string | null;
  reviewerNotes: string | null;
  riskFlags: string[];
  missingEvidence: string[];
  recommendedAction: string | null;
  seniorApprovalRequired: boolean;
  decisionReason: string | null;
  nextPrompt: string | null;
  createdAt: string;
  riskFlagDetails: RiskFlagDetail[];
  missingEvidenceDetails: MissingEvidenceDetail[];
}

interface Props {
  taskId: string;
  taskTitle: string;
}

const DECISION_BADGE_CLASS: Record<string, string> = {
  BLOCKED:                  'badge badge-BLOCKED',
  SENIOR_APPROVAL_REQUIRED: 'badge badge-SENIOR_APPROVAL_REQUIRED',
  RUN_VALIDATION:           'badge badge-RUN_VALIDATION',
  ASK_AGENT_FOR_EVIDENCE:   'badge badge-ASK_AGENT_FOR_EVIDENCE',
  CONTINUE:                 'badge badge-CONTINUE',
};

const SEV_CLASS: Record<string, string> = {
  critical: 'badge badge-sev-critical',
  high:     'badge badge-sev-high',
  medium:   'badge badge-sev-medium',
  low:      'badge badge-sev-low',
};

const SEV_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

const BLOCKED_KEYS = new Set(['destructive-command', 'secrets-exposure']);
const SENIOR_KEYS  = new Set(['auth-security-change', 'database-migration', 'production-environment', 'infra-docker-ci']);

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  async function handleCopy() {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch {}
  }
  return (
    <button onClick={handleCopy} className={`copy-btn${copied ? ' copied' : ''}`} style={{ marginTop: 8 }}>
      {copied ? '✓ Copied' : '⎘ Copy Prompt'}
    </button>
  );
}

function DecisionFactors({ session, action }: { session: EnrichedSession; action: string }) {
  const blocking    = session.riskFlagDetails.filter((f) => BLOCKED_KEYS.has(f.key));
  const seniorNeeds = session.riskFlagDetails.filter((f) => SENIOR_KEYS.has(f.key));
  const missing     = session.missingEvidenceDetails;

  if (action === 'CONTINUE' && missing.length === 0) return null;

  return (
    <div className="card card-sm" style={{ borderLeft: '3px solid var(--brand)' }}>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', marginBottom: 10 }}>
        Why This Decision
      </div>
      {blocking.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--red-text)' }}>Blocking flags:</span>
          <ul style={{ margin: '4px 0 0 16px', padding: 0, fontSize: 13, color: 'var(--text-secondary)' }}>
            {blocking.map((f) => <li key={f.key}>{f.label} — {f.description}</li>)}
          </ul>
        </div>
      )}
      {seniorNeeds.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--orange-text)' }}>Senior approval required for:</span>
          <ul style={{ margin: '4px 0 0 16px', padding: 0, fontSize: 13, color: 'var(--text-secondary)' }}>
            {seniorNeeds.map((f) => <li key={f.key}>{f.label}</li>)}
          </ul>
        </div>
      )}
      {missing.length > 0 && (
        <div>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--amber-text)' }}>Missing evidence:</span>
          <ul style={{ margin: '4px 0 0 16px', padding: 0, fontSize: 13, color: 'var(--text-secondary)' }}>
            {missing.map((e) => <li key={e.key}>{e.label} — {e.description}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

function AnalysisPanel({ session }: { session: EnrichedSession }) {
  const action = session.recommendedAction ?? 'CONTINUE';
  const sortedFlags = [...session.riskFlagDetails].sort(
    (a, b) => (SEV_ORDER[a.severity] ?? 9) - (SEV_ORDER[b.severity] ?? 9),
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
      <DecisionBanner
        decision={action}
        reason={session.decisionReason}
        seniorApprovalRequired={session.seniorApprovalRequired}
      />

      <DecisionFactors session={session} action={action} />

      <div className="analysis-grid">
        <div className="card card-sm">
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', marginBottom: 10 }}>
            Risk Flags {sortedFlags.length > 0 && <span style={{ fontWeight: 400 }}>({sortedFlags.length})</span>}
          </div>
          {sortedFlags.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--green-text)' }}>✓ No risk flags detected</p>
          ) : (
            sortedFlags.map((f) => {
              const isBlocking = BLOCKED_KEYS.has(f.key);
              const needsSenior = SENIOR_KEYS.has(f.key);
              return (
                <div key={f.key} className="risk-item">
                  <span className={SEV_CLASS[f.severity] ?? 'badge badge-neutral'}>{f.severity.toUpperCase()}</span>
                  <span className="risk-item-label">
                    {f.label}
                    {isBlocking  && <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--red-text)', fontWeight: 700 }}>BLOCKS</span>}
                    {needsSenior && <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--orange-text)', fontWeight: 700 }}>SENIOR</span>}
                  </span>
                  <span className="risk-item-desc">{f.description}</span>
                </div>
              );
            })
          )}
        </div>

        <div className="card card-sm">
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', marginBottom: 10 }}>
            Missing Evidence {session.missingEvidenceDetails.length > 0 && <span style={{ fontWeight: 400 }}>({session.missingEvidenceDetails.length})</span>}
          </div>
          {session.missingEvidenceDetails.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--green-text)' }}>✓ All required evidence provided</p>
          ) : (
            session.missingEvidenceDetails.map((e) => (
              <div key={e.key} className="evidence-item">
                <span className="evidence-item-label">✗ {e.label}</span>
                <span className="evidence-item-desc">{e.description}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {session.nextPrompt && (
        <div className="card card-sm">
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', marginBottom: 10 }}>
            Recommended Next Prompt
          </div>
          <pre className="prompt-block prompt-block-scrollable">{session.nextPrompt}</pre>
          <CopyBtn text={session.nextPrompt} />
        </div>
      )}
    </div>
  );
}

export default function OperatorPanel({ taskId, taskTitle }: Props) {
  const router = useRouter();
  const [sessions, setSessions] = useState<EnrichedSession[]>([]);
  const [loadError, setLoadError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  const [agentTool, setAgentTool] = useState('claude-code-manual');
  const [agentResponse, setAgentResponse] = useState('');
  const [filesMentioned, setFilesMentioned] = useState('');
  const [commandsMentioned, setCommandsMentioned] = useState('');
  const [validationOutput, setValidationOutput] = useState('');
  const [reviewerNotes, setReviewerNotes] = useState('');

  useEffect(() => {
    fetch(`/api/operator-sessions?taskId=${encodeURIComponent(taskId)}`)
      .then((r) => r.json())
      .then((data) => {
        const list: EnrichedSession[] = data.sessions ?? [];
        setSessions(list);
        if (list.length > 0) setActiveSessionId(list[0].id);
      })
      .catch(() => setLoadError('Failed to load operator sessions.'));
  }, [taskId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError('');
    try {
      const res = await fetch('/api/operator-sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId, agentTool, agentResponse, filesMentioned, commandsMentioned, validationOutput, reviewerNotes }),
      });
      const data = await res.json();
      if (!res.ok) { setSubmitError(data.error ?? 'Failed to submit.'); return; }
      const newSession: EnrichedSession = data.session;
      setSessions((prev) => [newSession, ...prev]);
      setActiveSessionId(newSession.id);
      setAgentResponse(''); setFilesMentioned(''); setCommandsMentioned(''); setValidationOutput(''); setReviewerNotes('');
      router.refresh();
    } catch {
      setSubmitError('Network error — please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const activeSession = sessions.find((s) => s.id === activeSessionId) ?? null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="card">
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', marginBottom: 14 }}>
          Paste Agent Output
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16, marginTop: -6 }}>
          After running a prompt, paste the agent response here. The system will analyze risk,
          identify missing evidence, and determine the safest next step.
        </p>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor="op-agentTool">Agent / Tool Used</label>
            <select id="op-agentTool" value={agentTool} onChange={(e) => setAgentTool(e.target.value)}>
              <option value="claude-code-manual">Claude Code (manual)</option>
              <option value="codex-manual">Codex (manual)</option>
              <option value="openclaw-manual">OpenClaw (manual)</option>
              <option value="open-swe">Open SWE</option>
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor="op-agentResponse">
              Agent Response <span style={{ color: 'var(--red)' }}>*</span>
            </label>
            <textarea
              id="op-agentResponse"
              value={agentResponse}
              onChange={(e) => setAgentResponse(e.target.value)}
              rows={8}
              placeholder="Paste the full agent output here…"
              required
              style={{ fontFamily: 'monospace', fontSize: 12 }}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="op-files">Files Changed / Mentioned</label>
              <textarea
                id="op-files"
                value={filesMentioned}
                onChange={(e) => setFilesMentioned(e.target.value)}
                rows={3}
                placeholder={"src/app/api/tasks/route.ts\nprisma/schema.prisma"}
                style={{ fontFamily: 'monospace', fontSize: 12 }}
              />
              <div className="form-hint">One per line</div>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="op-commands">Commands Run</label>
              <textarea
                id="op-commands"
                value={commandsMentioned}
                onChange={(e) => setCommandsMentioned(e.target.value)}
                rows={3}
                placeholder={"npm run build\nnpx prisma migrate dev"}
                style={{ fontFamily: 'monospace', fontSize: 12 }}
              />
              <div className="form-hint">One per line</div>
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor="op-validation">Validation / Build / Test Output</label>
            <textarea
              id="op-validation"
              value={validationOutput}
              onChange={(e) => setValidationOutput(e.target.value)}
              rows={4}
              placeholder="Paste the exact build, test, or lint output here…"
              style={{ fontFamily: 'monospace', fontSize: 12 }}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor="op-notes">Operator Notes</label>
            <textarea
              id="op-notes"
              value={reviewerNotes}
              onChange={(e) => setReviewerNotes(e.target.value)}
              rows={2}
              placeholder="Any concerns, context, or observations about this run…"
            />
          </div>

          {submitError && (
            <div style={{ background: 'var(--red-bg)', color: 'var(--red-text)', borderRadius: 'var(--radius-sm)', padding: '8px 12px', fontSize: 13 }}>
              {submitError}
            </div>
          )}

          <div>
            <button type="submit" disabled={submitting} className="btn btn-primary">
              {submitting ? 'Analyzing…' : 'Analyze Response'}
            </button>
          </div>
        </form>
      </div>

      {loadError && <p style={{ fontSize: 13, color: 'var(--red)' }}>{loadError}</p>}

      {activeSession && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', marginBottom: 4 }}>
            Analysis — Step {activeSession.currentStep}
          </div>
          <AnalysisPanel session={activeSession} />
        </div>
      )}

      {sessions.length > 0 && (
        <div className="card card-sm">
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', marginBottom: 10 }}>
            Session History ({sessions.length})
          </div>
          {sessions.map((s) => {
            const action = s.recommendedAction ?? 'CONTINUE';
            const isActive = s.id === activeSessionId;
            return (
              <div
                key={s.id}
                className={`session-timeline-row${isActive ? ' active' : ''}`}
                onClick={() => setActiveSessionId(s.id)}
              >
                <span className={DECISION_BADGE_CLASS[action] ?? 'badge badge-neutral'}>
                  {action.replace(/_/g, ' ')}
                </span>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)', flex: 1 }}>
                  Step {s.currentStep} · {s.agentTool ?? 'unknown'} · {new Date(s.createdAt).toLocaleString()}
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'right' }}>
                  {s.riskFlagDetails.length > 0
                    ? s.riskFlagDetails
                        .sort((a, b) => (SEV_ORDER[a.severity] ?? 9) - (SEV_ORDER[b.severity] ?? 9))
                        .slice(0, 2)
                        .map((f) => f.label)
                        .join(', ') + (s.riskFlagDetails.length > 2 ? ` +${s.riskFlagDetails.length - 2}` : '')
                    : '✓ No flags'}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
