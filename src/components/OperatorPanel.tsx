'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

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

const SEVERITY_STYLE: Record<string, React.CSSProperties> = {
  critical: { background: '#dc2626', color: '#fff' },
  high:     { background: '#ea580c', color: '#fff' },
  medium:   { background: '#d97706', color: '#fff' },
  low:      { background: '#2563eb', color: '#fff' },
};

const DECISION_STYLE: Record<string, React.CSSProperties> = {
  BLOCKED:                  { background: '#dc2626', color: '#fff' },
  SENIOR_APPROVAL_REQUIRED: { background: '#ea580c', color: '#fff' },
  RUN_VALIDATION:           { background: '#d97706', color: '#fff' },
  ASK_AGENT_FOR_EVIDENCE:   { background: '#2563eb', color: '#fff' },
  CONTINUE:                 { background: '#16a34a', color: '#fff' },
};

function Badge({ text, style }: { text: string; style: React.CSSProperties }) {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 10px',
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: '0.03em',
        ...style,
      }}
    >
      {text}
    </span>
  );
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }
  return (
    <button
      onClick={handleCopy}
      className="bg-indigo-600 text-white px-4 py-2 rounded"
      style={{ marginTop: 8 }}
    >
      {copied ? 'Copied!' : 'Copy Prompt'}
    </button>
  );
}

function AnalysisPanel({ session }: { session: EnrichedSession }) {
  const action = session.recommendedAction ?? 'CONTINUE';
  const decisionStyle = DECISION_STYLE[action] ?? DECISION_STYLE.CONTINUE;

  return (
    <div className="space-y-4" style={{ marginTop: 16 }}>
      {/* Senior Approval Banner */}
      {session.seniorApprovalRequired && (
        <div
          style={{
            background: '#fef2f2',
            border: '2px solid #dc2626',
            borderRadius: 6,
            padding: '12px 16px',
          }}
        >
          <p style={{ margin: 0, fontWeight: 700, color: '#b91c1c', fontSize: 14 }}>
            ⚠ Senior Approval Required — Do not continue until a senior engineer reviews.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
        {/* Current Risk */}
        <div className="border rounded p-4">
          <p className="font-semibold text-sm mb-2">Current Risk</p>
          {session.riskFlagDetails.length === 0 ? (
            <p className="text-sm" style={{ color: '#16a34a' }}>No risk flags detected.</p>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }} className="space-y-4">
              {session.riskFlagDetails.map((f) => (
                <li key={f.key} style={{ marginBottom: 8 }}>
                  <Badge text={f.severity.toUpperCase()} style={SEVERITY_STYLE[f.severity] ?? {}} />
                  {' '}
                  <span className="text-sm font-medium">{f.label}</span>
                  <p className="text-xs" style={{ color: '#6b7280', marginTop: 2 }}>{f.description}</p>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Missing Evidence */}
        <div className="border rounded p-4">
          <p className="font-semibold text-sm mb-2">Missing Evidence</p>
          {session.missingEvidenceDetails.length === 0 ? (
            <p className="text-sm" style={{ color: '#16a34a' }}>All required evidence provided.</p>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {session.missingEvidenceDetails.map((e) => (
                <li key={e.key} style={{ marginBottom: 8 }}>
                  <span className="text-sm font-medium" style={{ color: '#b91c1c' }}>✗ {e.label}</span>
                  <p className="text-xs" style={{ color: '#6b7280', marginTop: 2 }}>{e.description}</p>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Recommended Action */}
        <div className="border rounded p-4">
          <p className="font-semibold text-sm mb-2">Recommended Action</p>
          <Badge text={action} style={decisionStyle} />
          <p className="text-sm" style={{ marginTop: 8, color: '#374151' }}>
            {session.decisionReason}
          </p>
        </div>
      </div>

      {/* Next Prompt */}
      {session.nextPrompt && (
        <div className="border rounded p-4">
          <p className="font-semibold text-sm mb-2">Next Prompt to Copy</p>
          <pre
            style={{
              background: '#f9fafb',
              border: '1px solid #d1d5db',
              borderRadius: 4,
              padding: 12,
              fontSize: 12,
              whiteSpace: 'pre-wrap',
              maxHeight: 260,
              overflowY: 'auto',
              fontFamily: 'Menlo, Monaco, "Courier New", monospace',
              lineHeight: 1.55,
            }}
          >
            {session.nextPrompt}
          </pre>
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

  // Form state
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
        body: JSON.stringify({
          taskId,
          agentTool,
          agentResponse,
          filesMentioned,
          commandsMentioned,
          validationOutput,
          reviewerNotes,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error ?? 'Failed to submit.');
        return;
      }
      const newSession: EnrichedSession = data.session;
      setSessions((prev) => [newSession, ...prev]);
      setActiveSessionId(newSession.id);
      // Clear form
      setAgentResponse('');
      setFilesMentioned('');
      setCommandsMentioned('');
      setValidationOutput('');
      setReviewerNotes('');
      router.refresh();
    } catch {
      setSubmitError('Network error — please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const activeSession = sessions.find((s) => s.id === activeSessionId) ?? null;

  return (
    <div className="space-y-8">
      {/* Submit form */}
      <div className="border rounded p-4">
        <h3 className="font-semibold text-lg mb-2">Operator Run — Paste Agent Output</h3>
        <p className="text-sm" style={{ color: '#6b7280', marginBottom: 12 }}>
          After running a prompt in Claude Code, Codex, or OpenClaw, paste the response here.
          The system will analyze risk, identify missing evidence, and generate the safest next step.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="op-agentTool">Agent / Tool Used</label>
            <select
              id="op-agentTool"
              value={agentTool}
              onChange={(e) => setAgentTool(e.target.value)}
              className="w-full border rounded px-3 py-2"
            >
              <option value="claude-code-manual">Claude Code (manual)</option>
              <option value="codex-manual">Codex (manual)</option>
              <option value="openclaw-manual">OpenClaw (manual)</option>
              <option value="open-swe">Open SWE</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="op-agentResponse">
              Agent Response <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <textarea
              id="op-agentResponse"
              value={agentResponse}
              onChange={(e) => setAgentResponse(e.target.value)}
              rows={7}
              className="w-full border rounded px-3 py-2"
              placeholder="Paste the full agent output here…"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1" htmlFor="op-files">
                Files Changed / Mentioned
              </label>
              <textarea
                id="op-files"
                value={filesMentioned}
                onChange={(e) => setFilesMentioned(e.target.value)}
                rows={3}
                className="w-full border rounded px-3 py-2"
                placeholder="src/app/api/tasks/route.ts&#10;prisma/schema.prisma"
              />
              <p className="text-xs" style={{ color: '#6b7280', marginTop: 4 }}>One per line</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" htmlFor="op-commands">
                Commands Run
              </label>
              <textarea
                id="op-commands"
                value={commandsMentioned}
                onChange={(e) => setCommandsMentioned(e.target.value)}
                rows={3}
                className="w-full border rounded px-3 py-2"
                placeholder="npm run build&#10;npx prisma migrate dev"
              />
              <p className="text-xs" style={{ color: '#6b7280', marginTop: 4 }}>One per line</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="op-validation">
              Validation / Build / Test Output
            </label>
            <textarea
              id="op-validation"
              value={validationOutput}
              onChange={(e) => setValidationOutput(e.target.value)}
              rows={4}
              className="w-full border rounded px-3 py-2"
              placeholder="Paste the exact build, test, or lint output here…"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="op-notes">
              Operator Notes
            </label>
            <textarea
              id="op-notes"
              value={reviewerNotes}
              onChange={(e) => setReviewerNotes(e.target.value)}
              rows={2}
              className="w-full border rounded px-3 py-2"
              placeholder="Any concerns, context, or observations about this run…"
            />
          </div>

          {submitError && (
            <p className="text-sm text-red-600">{submitError}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="bg-indigo-600 text-white px-4 py-2 rounded disabled:opacity-50"
          >
            {submitting ? 'Analyzing…' : 'Analyze Response'}
          </button>
        </form>
      </div>

      {/* Analysis panel for active session */}
      {loadError && <p className="text-sm text-red-600">{loadError}</p>}
      {activeSession && (
        <div>
          <h3 className="font-semibold text-lg mb-2">
            Analysis — Step {activeSession.currentStep}
          </h3>
          <AnalysisPanel session={activeSession} />
        </div>
      )}

      {/* Session Timeline */}
      {sessions.length > 0 && (
        <div className="border rounded p-4">
          <h3 className="font-semibold text-sm mb-2">Operator Session Timeline</h3>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {sessions.map((s, i) => {
              const action = s.recommendedAction ?? 'CONTINUE';
              const style = DECISION_STYLE[action] ?? DECISION_STYLE.CONTINUE;
              const isActive = s.id === activeSessionId;
              return (
                <li
                  key={s.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 0',
                    borderTop: i > 0 ? '1px solid #e5e7eb' : undefined,
                    cursor: 'pointer',
                    fontWeight: isActive ? 700 : 400,
                  }}
                  onClick={() => setActiveSessionId(s.id)}
                >
                  <Badge text={action} style={style} />
                  <span className="text-xs" style={{ color: '#6b7280', flex: 1 }}>
                    Step {s.currentStep} · {s.agentTool ?? 'unknown tool'} ·{' '}
                    {new Date(s.createdAt).toLocaleString()}
                  </span>
                  <span className="text-xs" style={{ color: '#6b7280' }}>
                    {s.riskFlags.length} risk{s.riskFlags.length !== 1 ? 's' : ''} ·{' '}
                    {s.missingEvidence.length} missing
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
