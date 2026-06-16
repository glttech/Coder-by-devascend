import type { WidgetKey } from '@/hooks/useWidgetLayout';
export const WIDGET_KEYS_LIST = ['task-summary', 'recent-runs', 'pending-approvals', 'project-health', 'ci-status'] as const;
export type { WidgetKey };

export interface WidgetLayout { order: WidgetKey[]; hidden: WidgetKey[]; }

export function parseLayout(raw: string | null): WidgetLayout {
  const defaultLayout = { order: [...WIDGET_KEYS_LIST] as WidgetKey[], hidden: [] };
  if (!raw) return defaultLayout;
  try {
    return JSON.parse(raw) as WidgetLayout;
  } catch {
    return defaultLayout;
  }
}

export function toggleHidden(layout: WidgetLayout, key: WidgetKey): WidgetLayout {
  return {
    ...layout,
    hidden: layout.hidden.includes(key)
      ? layout.hidden.filter(k => k !== key)
      : [...layout.hidden, key],
  };
}

export function moveInOrder(layout: WidgetLayout, key: WidgetKey, direction: 'up' | 'down'): WidgetLayout {
  const order = [...layout.order];
  const idx = order.indexOf(key);
  if (idx === -1) return layout;
  const newIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (newIdx < 0 || newIdx >= order.length) return layout;
  [order[idx], order[newIdx]] = [order[newIdx], order[idx]];
  return { ...layout, order };
}
