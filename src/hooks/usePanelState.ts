'use client';

import { useState, useEffect } from 'react';
import { clientStorage } from '@/lib/clientStorage';

export function usePanelState(key: string, defaultOpen = true): [boolean, () => void] {
  const [open, setOpen] = useState<boolean>(() => {
    const stored = clientStorage.get<boolean>(`panel.${key}`);
    return stored !== null ? stored : defaultOpen;
  });

  useEffect(() => {
    const stored = clientStorage.get<boolean>(`panel.${key}`);
    if (stored !== null) setOpen(stored);
  }, [key]);

  const toggle = () => {
    setOpen(prev => {
      const next = !prev;
      clientStorage.set(`panel.${key}`, next);
      return next;
    });
  };

  return [open, toggle];
}
