'use client';
import { useState, useEffect } from 'react';

export const WIDGET_KEYS = ['task-summary', 'recent-runs', 'pending-approvals', 'project-health', 'ci-status'] as const;
export type WidgetKey = typeof WIDGET_KEYS[number];

const STORAGE_KEY = 'cda.widget-layout';
const DEFAULT_ORDER = [...WIDGET_KEYS];

export interface WidgetLayout {
  order: WidgetKey[];
  hidden: WidgetKey[];
}

function loadLayout(): WidgetLayout {
  if (typeof window === 'undefined') return { order: DEFAULT_ORDER, hidden: [] };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { order: DEFAULT_ORDER, hidden: [] };
    return JSON.parse(raw) as WidgetLayout;
  } catch {
    return { order: DEFAULT_ORDER, hidden: [] };
  }
}

export function useWidgetLayout() {
  const [layout, setLayout] = useState<WidgetLayout>({ order: DEFAULT_ORDER, hidden: [] });

  useEffect(() => {
    setLayout(loadLayout());
  }, []);

  function save(next: WidgetLayout) {
    setLayout(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  function toggleWidget(key: WidgetKey) {
    const next: WidgetLayout = {
      order: layout.order,
      hidden: layout.hidden.includes(key)
        ? layout.hidden.filter(k => k !== key)
        : [...layout.hidden, key],
    };
    save(next);
  }

  function moveWidget(key: WidgetKey, direction: 'up' | 'down') {
    const order = [...layout.order];
    const idx = order.indexOf(key);
    if (idx === -1) return;
    const newIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= order.length) return;
    [order[idx], order[newIdx]] = [order[newIdx], order[idx]];
    save({ ...layout, order });
  }

  function resetLayout() {
    save({ order: DEFAULT_ORDER, hidden: [] });
  }

  const visible = layout.order.filter(k => !layout.hidden.includes(k));

  return { layout, visible, toggleWidget, moveWidget, resetLayout };
}
