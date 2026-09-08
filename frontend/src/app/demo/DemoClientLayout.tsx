'use client';

import { DemoModeProvider } from '@/contexts/DemoModeContext';
import { DemoSessionProvider } from '@/contexts/DemoSessionContext';

/**
 * Demo chrome: isolated fixture + session, and DemoMode so shared cards
 * never link into the live app.
 */
export default function DemoClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <DemoModeProvider>
      <DemoSessionProvider>{children}</DemoSessionProvider>
    </DemoModeProvider>
  );
}
