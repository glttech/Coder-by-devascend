'use client';
import { useState, useEffect } from 'react';

export default function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    // Read current theme from document
    const current = (document.documentElement.getAttribute('data-theme') as 'light' | 'dark') ?? 'light';
    setTheme(current);
  }, []);

  function toggle() {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    // Persist to localStorage
    try {
      localStorage.setItem('cda.theme', JSON.stringify({ v: 1, data: next }));
    } catch {}
  }

  return (
    <button
      onClick={toggle}
      title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
      style={{
        background: 'none',
        border: '1px solid var(--border)',
        borderRadius: 6,
        padding: '4px 8px',
        cursor: 'pointer',
        fontSize: 14,
        color: 'var(--text-secondary)',
        lineHeight: 1,
      }}
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
    >
      {theme === 'light' ? '🌙' : '☀️'}
    </button>
  );
}
