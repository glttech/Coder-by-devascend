'use client';

import { useEffect, useRef, useState } from 'react';

interface LogLine {
  ts: string;
  line: string;
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

function formatTs(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString(undefined, { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return '';
  }
}

export default function LogViewer({ sessionId, initial }: { sessionId: string; initial: SessionData }) {
  const [session, setSession] = useState<SessionData>(initial);
  const [error, setError] = useState<string | null>(null);
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

  return (
    <div>
      {/* Meta strip */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 16,
          alignItems: 'center',
          marginBottom: 20,
          padding: '12px 16px',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 8,
        }}
      >
        <StatusBadge status={session.status} />

        <code style={{ fontSize: 13, flex: 1, minWidth: 0, wordBreak: 'break-all' }}>
          {session.command}
        </code>

        {session.exitCode !== null && (
          <span style={{ fontSize: 12, color: session.exitCode === 0 ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
            exit {session.exitCode}
          </span>
        )}
      </div>

      {session.workingDir && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
          <strong>Working dir:</strong> <code>{session.workingDir}</code>
        </div>
      )}

      {session.task && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
          <strong>Task:</strong>{' '}
          <a href={`/tasks/${session.task.id}`} style={{ color: 'var(--blue)' }}>
            {session.task.title}
          </a>
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
