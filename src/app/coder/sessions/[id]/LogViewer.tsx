'use client';

import { useEffect, useRef, useState } from 'react';

interface LogLine {
  ts: string;
  line: string;
}

interface LinkedPR {
  id: string;
  prNumber: number;
  title: string;
  state: string;
  merged: boolean;
  ciStatus: string | null;
  prUrl: string | null;
  sourceBranch: string | null;
}

interface SessionData {
  id: string;
  command: string;
  workingDir: string;
  status: string;
  exitCode: number | null;
  logLines: LogLine[] | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  task: { id: string; title: string; projectId: string } | null;
  repository: { id: string; fullName: string } | null;
  summary: string | null;
  failureReason: string | null;
  filesChanged: string[];
  repositoryPRs: LinkedPR[];
}

const TERMINAL_STATUSES = new Set(['completed', 'failed', 'cancelled']);

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, React.CSSProperties> = {
    pending: { background: 'rgba(100,116,139,0.1)', color: '#64748b', border: '1px solid rgba(100,116,139,0.3)' },
    running: { background: 'rgba(59,130,246,0.1)', color: '#2563eb', border: '1px solid rgba(59,130,246,0.3)' },
    completed: { background: 'rgba(34,197,94,0.1)', color: '#16a34a', border: '1px solid rgba(34,197,94,0.3)' },
    failed: { background: 'rgba(239,68,68,0.1)', color: '#dc2626', border: '1px solid rgba(239,68,68,0.3)' },
    cancelled: { background: 'rgba(156,163,175,0.1)', color: '#6b7280', border: '1px solid rgba(156,163,175,0.3)' },
  };
  const style = styles[status] ?? styles.pending;
  return (
    <span style={{ ...style, padding: '3px 10px', borderRadius: 4, fontSize: 12, fontWeight: 600 }}>
      {status}
    </span>
  );
}

function PrStateBadge({ pr }: { pr: LinkedPR }) {
  if (pr.merged) return <span style={{ background: 'rgba(139,92,246,0.12)', color: '#7c3aed', border: '1px solid rgba(139,92,246,0.3)', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>merged</span>;
  if (pr.state === 'open') return <span style={{ background: 'rgba(34,197,94,0.1)', color: '#16a34a', border: '1px solid rgba(34,197,94,0.3)', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>open</span>;
  return <span style={{ background: 'rgba(156,163,175,0.1)', color: '#6b7280', border: '1px solid rgba(156,163,175,0.3)', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>closed</span>;
}

function formatTs(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString(undefined, { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return '';
  }
}

function formatDuration(start: string | null, end: string | null): string {
  if (!start) return '—';
  const endMs = end ? new Date(end).getTime() : Date.now();
  const secs = Math.round((endMs - new Date(start).getTime()) / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  return `${mins}m ${secs % 60}s`;
}

const PANEL_STYLE: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '16px 20px',
  marginBottom: 16,
};

const LABEL_STYLE: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginBottom: 6,
};

export default function LogViewer({ sessionId, initial }: { sessionId: string; initial: SessionData }) {
  const [session, setSession] = useState<SessionData>(initial);
  const [error, setError] = useState<string | null>(null);
  const [showAllFiles, setShowAllFiles] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (TERMINAL_STATUSES.has(session.status)) return;

    function poll() {
      fetch(`/api/coder/sessions/${sessionId}`)
        .then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json() as Promise<SessionData>;
        })
        .then((data) => {
          setSession(data);
          if (TERMINAL_STATUSES.has(data.status) && intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
        })
        .catch((err: Error) => setError(err.message));
    }

    intervalRef.current = setInterval(poll, 2000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [sessionId, session.status]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [session.logLines?.length]);

  const lines: LogLine[] = Array.isArray(session.logLines) ? (session.logLines as LogLine[]) : [];
  const hasIntelligence = session.summary || session.failureReason || session.filesChanged.length > 0 || session.repositoryPRs.length > 0;
  const visibleFiles = showAllFiles ? session.filesChanged : session.filesChanged.slice(0, 10);

  return (
    <div>
      {/* Meta strip */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', marginBottom: 16, ...PANEL_STYLE }}>
        <StatusBadge status={session.status} />

        <code style={{ fontSize: 13, flex: 1, minWidth: 0, wordBreak: 'break-all' }}>
          {session.command}
        </code>

        {session.exitCode !== null && (
          <span style={{ fontSize: 12, color: session.exitCode === 0 ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
            exit {session.exitCode}
          </span>
        )}

        {(session.startedAt || session.completedAt) && (
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {formatDuration(session.startedAt, session.completedAt)}
          </span>
        )}
      </div>

      {/* Context strip */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
        {session.workingDir && (
          <span><strong>Dir:</strong> <code>{session.workingDir}</code></span>
        )}
        {session.repository && (
          <span>
            <strong>Repo:</strong>{' '}
            <a href={`/coder/repositories/${session.repository.id}`} style={{ color: 'var(--blue)' }}>
              {session.repository.fullName}
            </a>
          </span>
        )}
        {session.task && (
          <span>
            <strong>Task:</strong>{' '}
            <a href={`/tasks/${session.task.id}`} style={{ color: 'var(--blue)' }}>
              {session.task.title}
            </a>
          </span>
        )}
      </div>

      {/* Intelligence panel */}
      {hasIntelligence && (
        <div style={PANEL_STYLE}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 14 }}>Session Intelligence</div>

          {session.summary && (
            <div style={{ marginBottom: 14 }}>
              <div style={LABEL_STYLE}>Summary</div>
              <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.6 }}>{session.summary}</div>
            </div>
          )}

          {session.failureReason && (
            <div style={{ marginBottom: 14 }}>
              <div style={LABEL_STYLE}>Failure Reason</div>
              <div style={{ fontSize: 13, color: '#dc2626', background: 'rgba(239,68,68,0.06)', padding: '8px 12px', borderRadius: 6, border: '1px solid rgba(239,68,68,0.2)' }}>
                {session.failureReason}
              </div>
            </div>
          )}

          {session.filesChanged.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={LABEL_STYLE}>Files Changed ({session.filesChanged.length})</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {visibleFiles.map((f, i) => (
                  <code key={i} style={{ fontSize: 11, color: 'var(--text-secondary)', background: 'var(--surface-raised, rgba(0,0,0,0.04))', padding: '2px 6px', borderRadius: 3 }}>
                    {f}
                  </code>
                ))}
                {session.filesChanged.length > 10 && (
                  <button
                    onClick={() => setShowAllFiles((v) => !v)}
                    style={{ marginTop: 4, fontSize: 11, color: 'var(--blue)', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}
                  >
                    {showAllFiles ? 'Show less' : `Show ${session.filesChanged.length - 10} more…`}
                  </button>
                )}
              </div>
            </div>
          )}

          {session.repositoryPRs.length > 0 && (
            <div>
              <div style={LABEL_STYLE}>Linked PRs</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {session.repositoryPRs.map((pr) => (
                  <div key={pr.id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
                    <PrStateBadge pr={pr} />
                    {pr.prUrl ? (
                      <a href={pr.prUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--blue)', fontWeight: 500 }}>
                        #{pr.prNumber} {pr.title}
                      </a>
                    ) : (
                      <span style={{ fontWeight: 500 }}>#{pr.prNumber} {pr.title}</span>
                    )}
                    {pr.sourceBranch && (
                      <code style={{ fontSize: 11, color: 'var(--text-muted)' }}>{pr.sourceBranch}</code>
                    )}
                    {pr.ciStatus && (
                      <span style={{ fontSize: 11, color: pr.ciStatus === 'success' ? '#16a34a' : pr.ciStatus === 'failure' ? '#dc2626' : 'var(--text-muted)' }}>
                        CI: {pr.ciStatus}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Log terminal */}
      <div
        style={{
          background: '#0d1117',
          border: '1px solid #30363d',
          borderRadius: 8,
          padding: '12px 16px',
          minHeight: 200,
          maxHeight: '60vh',
          overflowY: 'auto',
          fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace',
          fontSize: 12,
          lineHeight: 1.6,
          color: '#e6edf3',
        }}
      >
        {lines.length === 0 ? (
          <span style={{ color: '#8b949e', fontStyle: 'italic' }}>
            {session.status === 'pending' ? 'Waiting for session to start…' : 'No log output yet…'}
          </span>
        ) : (
          lines.map((entry, i) => (
            <div key={i} style={{ display: 'flex', gap: 12 }}>
              <span style={{ color: '#8b949e', userSelect: 'none', flexShrink: 0 }}>
                {formatTs(entry.ts)}
              </span>
              <span style={{ wordBreak: 'break-all' }}>{entry.line}</span>
            </div>
          ))
        )}

        {session.status === 'running' && (
          <div style={{ marginTop: 4, color: '#58a6ff' }}>
            <span className="pulse-dot" style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#58a6ff', marginRight: 8, verticalAlign: 'middle' }} />
            running…
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {error && (
        <div style={{ marginTop: 12, color: '#dc2626', fontSize: 12 }}>
          Poll error: {error}
        </div>
      )}

      {!TERMINAL_STATUSES.has(session.status) && (
        <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-muted)' }}>
          Auto-refreshing every 2 s while running
        </div>
      )}
    </div>
  );
}
