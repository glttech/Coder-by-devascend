"use client";

/**
 * A client-side button that triggers the browser's print dialog.
 * Must be a client component because it uses window.print().
 */
export default function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      style={{
        fontSize: 11,
        padding: '3px 10px',
        border: '1px solid var(--border)',
        borderRadius: 4,
        background: 'var(--surface)',
        cursor: 'pointer',
        color: 'var(--text-secondary)',
      }}
    >
      Print / Save PDF
    </button>
  );
}
