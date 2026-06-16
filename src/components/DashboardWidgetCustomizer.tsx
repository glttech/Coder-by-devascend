'use client';
import { useWidgetLayout, WIDGET_KEYS, WidgetKey } from '@/hooks/useWidgetLayout';
import { useState } from 'react';

const WIDGET_LABELS: Record<WidgetKey, string> = {
  'task-summary': 'Task Summary',
  'recent-runs': 'Recent Runs',
  'pending-approvals': 'Pending Approvals',
  'project-health': 'Project Health',
  'ci-status': 'CI Status',
};

export default function DashboardWidgetCustomizer() {
  const { layout, toggleWidget, moveWidget, resetLayout } = useWidgetLayout();
  const [open, setOpen] = useState(false);

  return (
    <div style={{ position: 'relative' }}>
      <button className="btn btn-ghost btn-sm" onClick={() => setOpen(o => !o)}>
        ⬡ Customize
      </button>
      {open && (
        <div style={{
          position: 'absolute', right: 0, top: '100%', marginTop: 4,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 8, padding: 16, zIndex: 100, width: 260,
          boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
        }}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12 }}>Dashboard Widgets</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {layout.order.map((key, idx) => {
              const hidden = layout.hidden.includes(key);
              return (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: hidden ? 0.5 : 1 }}>
                  <input type="checkbox" checked={!hidden} onChange={() => toggleWidget(key)} />
                  <span style={{ flex: 1, fontSize: 13 }}>{WIDGET_LABELS[key]}</span>
                  <button className="btn btn-ghost btn-sm" style={{ padding: '2px 6px', fontSize: 11 }} onClick={() => moveWidget(key, 'up')} disabled={idx === 0}>↑</button>
                  <button className="btn btn-ghost btn-sm" style={{ padding: '2px 6px', fontSize: 11 }} onClick={() => moveWidget(key, idx === layout.order.length - 1 ? 'up' : 'down')} disabled={idx === layout.order.length - 1}>↓</button>
                </div>
              );
            })}
          </div>
          <button className="btn btn-ghost btn-sm" style={{ marginTop: 12, width: '100%' }} onClick={resetLayout}>
            Reset to default
          </button>
        </div>
      )}
    </div>
  );
}
