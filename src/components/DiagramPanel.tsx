'use client';
import { useState, useEffect } from 'react';
import DiagramView from './DiagramView';

interface DiagramPanelProps {
  entityType: 'task' | 'project';
  entityId: string;
  generators: Array<{ kind: string; label: string; source: string }>;
}

interface SavedDiagram {
  id: string;
  kind: string;
  title: string;
  source: string;
  createdAt: string;
}

export default function DiagramPanel({ entityType, entityId, generators }: DiagramPanelProps) {
  const [selected, setSelected] = useState<{ kind: string; source: string; title: string } | null>(null);
  const [saved, setSaved] = useState<SavedDiagram[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(true);

  useEffect(() => {
    fetch(`/api/diagrams?entityType=${entityType}&entityId=${entityId}`)
      .then(r => r.json())
      .then((d: { diagrams?: SavedDiagram[] }) => { setSaved(d.diagrams ?? []); setLoadingSaved(false); })
      .catch(() => setLoadingSaved(false));
  }, [entityType, entityId]);

  function refreshSaved() {
    fetch(`/api/diagrams?entityType=${entityType}&entityId=${entityId}`)
      .then(r => r.json())
      .then((d: { diagrams?: SavedDiagram[] }) => setSaved(d.diagrams ?? []))
      .catch(() => {});
  }

  return (
    <div>
      {/* Generator buttons */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {generators.map(g => (
          <button
            key={g.kind}
            className={`btn btn-sm ${selected?.kind === g.kind ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setSelected({ kind: g.kind, source: g.source, title: g.label })}
          >
            {g.label}
          </button>
        ))}
      </div>

      {/* Active diagram */}
      {selected && (
        <div style={{ marginBottom: 20 }}>
          <DiagramView
            source={selected.source}
            title={selected.title}
            kind={selected.kind}
            entityType={entityType}
            entityId={entityId}
            onSaved={refreshSaved}
          />
        </div>
      )}

      {/* Saved diagrams */}
      {!loadingSaved && saved.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
            Saved Diagrams ({saved.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {saved.map(d => (
              <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 6 }}>
                <span className="badge badge-neutral" style={{ fontSize: 10 }}>{d.kind}</span>
                <span style={{ fontSize: 13, fontWeight: 500, flex: 1 }}>{d.title}</span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{new Date(d.createdAt).toLocaleDateString()}</span>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setSelected({ kind: d.kind, source: d.source, title: d.title })}
                >
                  View
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
