'use client';

import { clientStorage } from '@/lib/clientStorage';

export function useDraft<T>(key: string) {
  const draft = clientStorage.get<T>(`draft.${key}`);

  const saveDraft = (value: T) => {
    clientStorage.set(`draft.${key}`, value);
  };

  const clearDraft = () => {
    clientStorage.remove(`draft.${key}`);
  };

  return { draft, saveDraft, clearDraft };
}
