'use client';
import { useState, useEffect } from 'react';

export function useCsrfToken(): string | null {
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => {
    fetch('/api/auth/csrf')
      .then((r) => r.json())
      .then((d: { csrfToken?: string | null }) => setToken(d.csrfToken ?? null));
  }, []);
  return token;
}
