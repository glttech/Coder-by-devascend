'use client';

import { useState } from 'react';
import { clientStorage } from '@/lib/clientStorage';

const KEY = 'recentSearches';
const MAX = 10;

export function useRecentSearches() {
  const [recentSearches, setRecentSearches] = useState<string[]>(
    () => clientStorage.get<string[]>(KEY) ?? []
  );

  const addSearch = (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    setRecentSearches(prev => {
      const next = [trimmed, ...prev.filter(s => s !== trimmed)].slice(0, MAX);
      clientStorage.set(KEY, next);
      return next;
    });
  };

  const clearSearches = () => {
    clientStorage.remove(KEY);
    setRecentSearches([]);
  };

  return { recentSearches, addSearch, clearSearches };
}
