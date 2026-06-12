import './globals.css';
import type { ReactNode } from 'react';
import AppShell from '@/components/AppShell';
import MobileNav from '@/components/MobileNav';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head />
      <body>
        <AppShell>{children}</AppShell>
        <MobileNav />
      </body>
    </html>
  );
}
