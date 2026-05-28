import './globals.css';
import type { ReactNode } from 'react';
import Link from 'next/link';

/**
 * Top‑level layout for the app.  All pages are rendered within this
 * component.  A simple header displays the application name.  You can
 * extend this with navigation links as new pages are added.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head />
      <body className="bg-gray-50 text-gray-900">
        <header className="bg-indigo-600 text-white py-4 px-6 shadow flex items-center space-x-6">
          <h1 className="text-xl font-semibold flex-1">AI Dev Orchestrator</h1>
          <nav className="space-x-4 text-sm">
            <Link href="/">Dashboard</Link>
            <Link href="/tasks">Tasks</Link>
            <Link href="/instructions/pending">Pending Approvals</Link>
            <Link href="/audit">Audit Log</Link>
          </nav>
        </header>
        <main className="p-6 max-w-5xl mx-auto">{children}</main>
      </body>
    </html>
  );
}