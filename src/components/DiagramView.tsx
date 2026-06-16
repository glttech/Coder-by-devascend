'use client';
import { useState, useEffect, useRef } from 'react';

interface DiagramViewProps {
  source: string;
  title: string;
  diagramId?: string; // if already saved
  entityType?: string;
  entityId?: string;
  kind: string;
  onSaved?: (id: string) => void;
}

export default function DiagramView({ source, title, diagramId, entityType, entityId, kind, onSaved }: DiagramViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [rendered, setRendered] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState(diagramId ?? null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function render() {
      if (!containerRef.current) return;
      try {
        // Lazy-load mermaid to avoid SSR issues
        const mermaid = (await import('mermaid')).default;
        mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'neutral' });
        const id = `diagram-${Math.random().toString(36).slice(2)}`;
        const { svg } = await mermaid.render(id, source);
        if (!cancelled && containerRef.current) {
          containerRef.current.innerHTML = svg;
          setRendered(true);
        }
      } catch (e) {
        if (!cancelled) setError(String(e));
      }
    }
    render();
    return () => { cancelled = true; };
  }, [source]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/diagrams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, title, source, entityType, entityId }),
      });
      if (!res.ok) {
        const d = await res.json() as { error?: string };
        setError(d.error ?? 'Failed to save');
        return;
      }
      const { diagram } = await res.json() as { diagram: { id: string } };
      setSavedId(diagram.id);
      onSaved?.(diagram.id);
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  function handleExportSVG() {
    if (!containerRef.current) return;
    const svg = containerRef.current.innerHTML;
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/[^a-z0-9]/gi, '-')}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      {error && (
        <div style={{ padding: '8px 12px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 6, fontSize: 12, color: '#dc2626', marginBottom: 8 }}>
          Diagram error: {error}
        </div>
      )}
      <div
        ref={containerRef}
        style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 16, minHeight: 120, overflow: 'auto' }}
      >
        {!rendered && !error && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Rendering diagram…</span>}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
        {!savedId ? (
          <button
            className="btn btn-primary btn-sm"
            onClick={handleSave}
            disabled={saving || !rendered}
          >
            {saving ? 'Saving…' : '💾 Save diagram'}
          </button>
        ) : (
          <span style={{ fontSize: 12, color: '#16a34a', padding: '4px 8px' }}>✓ Saved</span>
        )}
        {rendered && (
          <button className="btn btn-ghost btn-sm" onClick={handleExportSVG}>
            Export SVG
          </button>
        )}
      </div>
    </div>
  );
}
