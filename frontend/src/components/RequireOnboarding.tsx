'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { AUTH_GATE_ENABLED } from '@/hooks/useModalState';
import { onboardingPath } from '@/lib/authHelpers';

/**
 * Sends authenticated-but-incomplete users to /onboarding.
 * Mount inside AppShell pages (home, map, leaderboards, party). Profile/create/host gate themselves.
 */
export default function RequireOnboarding({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, needsOnboarding } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!AUTH_GATE_ENABLED) return;
    if (isLoading) return;
    if (isAuthenticated && needsOnboarding) {
      const current =
        typeof window !== 'undefined'
          ? `${window.location.pathname}${window.location.search}`
          : pathname;
      router.replace(onboardingPath(current));
    }
  }, [isAuthenticated, isLoading, needsOnboarding, router, pathname]);

  if (AUTH_GATE_ENABLED && isAuthenticated && needsOnboarding) {
    return (
      <div className="flex justify-center py-24">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#b24bf3]" />
      </div>
    );
  }

  return <>{children}</>;
}
