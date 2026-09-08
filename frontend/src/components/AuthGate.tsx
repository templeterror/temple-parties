'use client';

import { Suspense, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { isAuthPublicPath, onboardingPath } from '@/lib/authHelpers';
import AuthWall from '@/components/AuthWall';

function AuthSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-black">
      <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-temple-purple" />
    </div>
  );
}

/**
 * Hard account wall around the live app. Public routes (login, Azure
 * callback, onboarding, recruiter demo) render through. Signed-in users
 * who still need username + school year are sent to /onboarding and never
 * see the live app — including /leaderboards.
 *
 * Wait until auth has resolved so a signed-in session never flashes the wall.
 * Suspense fallback is a spinner, not the page — useSearchParams in a child
 * must not un-wall the app.
 */
function AuthGateInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '/';
  const router = useRouter();
  const { isAuthenticated, isLoading, needsOnboarding } = useAuth();
  const publicPath = isAuthPublicPath(pathname);

  useEffect(() => {
    if (isLoading || !isAuthenticated || !needsOnboarding || publicPath) return;
    const current =
      typeof window !== 'undefined'
        ? `${window.location.pathname}${window.location.search}`
        : pathname;
    router.replace(onboardingPath(current));
  }, [isAuthenticated, isLoading, needsOnboarding, publicPath, router, pathname]);

  if (publicPath || isLoading) {
    return <>{children}</>;
  }

  if (!isAuthenticated) {
    return <AuthWall>{children}</AuthWall>;
  }

  if (needsOnboarding) {
    return <AuthSpinner />;
  }

  return <>{children}</>;
}

export default function AuthGate({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<AuthSpinner />}>
      <AuthGateInner>{children}</AuthGateInner>
    </Suspense>
  );
}
