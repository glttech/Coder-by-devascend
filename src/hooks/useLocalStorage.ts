'use client';

import { useState, useEffect } from 'react';
import { clientStorage } from '@/lib/clientStorage';

export function useLocalStorage<T>(key: string, initialValue: T): [T, (v: T) => void] {
  const [stored, setStored] = useState<T>(() => {
    return clientStorage.get<T>(key) ?? initialValue;
  });

  const setValue = (value: T) => {
    clientStorage.set(key, value);
    setStored(value);
  };

  useEffect(() => {
    const val = clientStorage.get<T>(key);
    if (val !== null) setStored(val);
  }, [key]);

  return [stored, setValue];
}
