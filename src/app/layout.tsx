import './globals.css';
import type { ReactNode } from 'react';
import AppShell from '@/components/AppShell';
import MobileNav from '@/components/MobileNav';
import { getFeatureFlags } from '@/lib/featureFlags';

export default function RootLayout({ children }: { children: ReactNode }) {
  const { notificationsEnabled } = getFeatureFlags();
  return (
    <html lang="en">
      <head />
      <body>
        <AppShell notificationsEnabled={notificationsEnabled}>{children}</AppShell>
        <MobileNav />
      </body>
    </html>
  );
}
