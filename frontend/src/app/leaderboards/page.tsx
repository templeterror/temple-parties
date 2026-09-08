'use client';

import { useState, useEffect } from 'react';
import RankingsView from '@/components/RankingsView';
import AppShell from '@/components/AppShell';
import PageSkeleton from '@/components/PageSkeleton';
import RequireOnboarding from '@/components/RequireOnboarding';
import { parseRankingsFilter, type RankingsFilter } from '@/components/RankingsDropdown';

export default function LeaderboardsPage() {
  const [isHydrated, setIsHydrated] = useState(false);
  const [initialFilter, setInitialFilter] = useState<RankingsFilter>('this-semester');

  // Read ?filter= after hydration (same window.location pattern as /map?party=)
  // so this page stays statically renderable without a Suspense boundary.
  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get('filter');
    setInitialFilter(parseRankingsFilter(raw) ?? 'this-semester');
    setIsHydrated(true);
  }, []);

  if (!isHydrated) {
    return (
      <AppShell>
        <PageSkeleton />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <RequireOnboarding>
        <RankingsView initialFilter={initialFilter} />
      </RequireOnboarding>
    </AppShell>
  );
}
