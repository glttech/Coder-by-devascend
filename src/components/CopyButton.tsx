"use client";

import { useState } from 'react';

/**
 * A client‑side button that copies the provided text to the clipboard.
 * This component lives in the `components` folder so it can be imported
 * into server components without causing hydration mismatches.  The
 * implementation uses the navigator.clipboard API which is only available
 * in the browser.
 */
export default function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      // Reset the copied state after a short delay
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard', err);
    }
  }
  return (
    <button
      onClick={handleCopy}
      type="button"
      className="mt-2 bg-indigo-600 text-white px-3 py-1 rounded text-sm"
    >
      {copied ? 'Copied!' : 'Copy Prompt'}
    </button>
  );
}