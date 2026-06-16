'use client';

import { useState } from 'react';
import { parseTranscript, type ParsedTranscript } from '@/lib/transcriptParser';

interface Props {
  taskId: string;
}

interface EditableFields {
  title: string;
  filesChanged: string;
  commandsRun: string;
  risksDetected: string;
}

const SECTION_STYLE: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
};

const LABEL_STYLE: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.07em',
  color: 'var(--text-muted)',
};

const TEXTAREA_STYLE: React.CSSProperties = {
  fontFamily: 'monospace',
  fontSize: 12,
  width: '100%',
  boxSizing: 'border-box',
};

export default function TranscriptParser({ taskId }: Props) {
  const [open, setOpen] = useState(false);
  const [raw, setRaw] = useState('');
  const [parsed, setParsed] = useState<ParsedTranscript | null>(null);
  const [editable, setEditable] = useState<EditableFields>({
    title: '',
    filesChanged: '',
    commandsRun: '',
    risksDetected: '',
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState('');

  function handleParse() {
    const result = parseTranscript(raw);
    setParsed(result);
    setEditable({
      title: result.suggestedTitle,
      filesChanged: result.filesChanged.join('\n'),
      commandsRun: result.commandsRun.join('\n'),
      risksDetected: result.risksDetected.join('\n'),
    });
    setSaveError('');
    setSaveSuccess('');
  }

  async function handleSave() {
    if (!parsed) return;
    setSaving(true);
    setSaveError('');
    setSaveSuccess('');

    const title = editable.title.trim() || parsed.suggestedTitle || 'AI Suggestion (from transcript)';
    const parsedData = {
      summary: parsed.summary,
      filesChanged: editable.filesChanged.split('\n').map((l) => l.trim()).filter(Boolean),
      commandsRun: editable.commandsRun.split('\n').map((l) => l.trim()).filter(Boolean),
      risksDetected: editable.risksDetected.split('\n').map((l) => l.trim()).filter(Boolean),
    };

    try {
      const res = await fetch('/api/instructions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId,
          title,
          body: raw,
          parsedData,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSaveError(data.error ?? 'Failed to save instruction.');
      } else {
        setSaveSuccess('Saved as AI Suggestion. See the AI Suggestions section below.');
        setRaw('');
        setParsed(null);
        setEditable({ title: '', filesChanged: '', commandsRun: '', risksDetected: '' });
      }
    } catch {
      setSaveError('Network error — please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card">
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          width: '100%',
          textAlign: 'left',
        }}
        aria-expanded={open}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
          Parse AI Transcript
        </span>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 4 }}>
          {open ? '▲' : '▼'}
        </span>
      </button>

      {!open && (
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6, marginBottom: 0 }}>
          Paste AI agent output to auto-extract files, commands, and risks.
        </p>
      )}

      {open && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 14 }}>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 0 }}>
            Paste the raw output from Claude Code, Cursor, Codex, or another AI agent. The parser
            will extract structured information to reduce manual entry.
          </p>

          {/* Raw transcript input */}
          <div style={SECTION_STYLE}>
            <label htmlFor="tp-raw" style={LABEL_STYLE}>
              AI Agent Output
            </label>
            <textarea
              id="tp-raw"
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              rows={10}
              placeholder="Paste AI agent output here…"
              style={{ ...TEXTAREA_STYLE, fontFamily: 'monospace', fontSize: 12 }}
            />
          </div>

          <div>
            <button
              className="btn btn-primary btn-sm"
              onClick={handleParse}
              disabled={raw.trim().length === 0}
            >
              Parse
            </button>
          </div>

          {/* Editable preview cards */}
          {parsed && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.07em',
                  color: 'var(--text-muted)',
                }}
              >
                Parsed Results — edit before saving
              </div>

              {/* Title */}
              <div style={SECTION_STYLE}>
                <label htmlFor="tp-title" style={LABEL_STYLE}>
                  Suggested Title
                </label>
                <input
                  id="tp-title"
                  type="text"
                  value={editable.title}
                  onChange={(e) => setEditable((prev) => ({ ...prev, title: e.target.value }))}
                  maxLength={500}
                  placeholder="Title for this AI suggestion"
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />
              </div>

              {/* Summary (read-only preview) */}
              {parsed.summary && (
                <div style={SECTION_STYLE}>
                  <div style={LABEL_STYLE}>Summary (auto-extracted)</div>
                  <div
                    style={{
                      fontSize: 13,
                      color: 'var(--text-secondary)',
                      background: 'var(--surface-2, rgba(0,0,0,0.03))',
                      border: '1px solid var(--border)',
                      borderRadius: 6,
                      padding: '8px 12px',
                    }}
                  >
                    {parsed.summary}
                  </div>
                </div>
              )}

              {/* Files changed */}
              <div style={SECTION_STYLE}>
                <label htmlFor="tp-files" style={LABEL_STYLE}>
                  Files Changed ({editable.filesChanged.split('\n').filter((l) => l.trim()).length})
                </label>
                {editable.filesChanged || parsed.filesChanged.length > 0 ? (
                  <textarea
                    id="tp-files"
                    value={editable.filesChanged}
                    onChange={(e) => setEditable((prev) => ({ ...prev, filesChanged: e.target.value }))}
                    rows={Math.max(3, editable.filesChanged.split('\n').length)}
                    placeholder="One file path per line"
                    style={TEXTAREA_STYLE}
                  />
                ) : (
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    No file paths detected.
                  </div>
                )}
              </div>

              {/* Commands run */}
              <div style={SECTION_STYLE}>
                <label htmlFor="tp-commands" style={LABEL_STYLE}>
                  Commands Run ({editable.commandsRun.split('\n').filter((l) => l.trim()).length})
                </label>
                {editable.commandsRun || parsed.commandsRun.length > 0 ? (
                  <textarea
                    id="tp-commands"
                    value={editable.commandsRun}
                    onChange={(e) => setEditable((prev) => ({ ...prev, commandsRun: e.target.value }))}
                    rows={Math.max(3, editable.commandsRun.split('\n').length)}
                    placeholder="One command per line"
                    style={TEXTAREA_STYLE}
                  />
                ) : (
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    No commands detected.
                  </div>
                )}
              </div>

              {/* Risks detected */}
              <div style={SECTION_STYLE}>
                <label htmlFor="tp-risks" style={LABEL_STYLE}>
                  Risks Detected ({editable.risksDetected.split('\n').filter((l) => l.trim()).length})
                </label>
                {editable.risksDetected || parsed.risksDetected.length > 0 ? (
                  <textarea
                    id="tp-risks"
                    value={editable.risksDetected}
                    onChange={(e) => setEditable((prev) => ({ ...prev, risksDetected: e.target.value }))}
                    rows={Math.max(3, editable.risksDetected.split('\n').length)}
                    placeholder="One risk per line"
                    style={{ ...TEXTAREA_STYLE, borderColor: editable.risksDetected.trim() ? 'var(--orange, #f97316)' : undefined }}
                  />
                ) : (
                  <div style={{ fontSize: 13, color: 'var(--green-text, #16a34a)', fontStyle: 'italic' }}>
                    No risk keywords detected.
                  </div>
                )}
              </div>

              {/* Save feedback */}
              {saveError && (
                <div
                  style={{
                    background: 'var(--red-bg)',
                    color: 'var(--red-text)',
                    borderRadius: 6,
                    padding: '8px 12px',
                    fontSize: 13,
                  }}
                >
                  {saveError}
                </div>
              )}
              {saveSuccess && (
                <div
                  style={{
                    padding: '8px 12px',
                    borderRadius: 6,
                    background: 'rgba(34,197,94,0.1)',
                    border: '1px solid rgba(34,197,94,0.3)',
                    color: '#16a34a',
                    fontSize: 13,
                    fontWeight: 500,
                  }}
                >
                  {saveSuccess}
                </div>
              )}

              <div>
                <button
                  className="btn btn-primary"
                  onClick={handleSave}
                  disabled={saving || editable.title.trim().length === 0}
                >
                  {saving ? 'Saving…' : 'Save as AI Suggestion'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
