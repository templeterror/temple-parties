'use client';

import RankingsView from '@/components/RankingsView';
import AppShell from '@/components/AppShell';
import DemoBanner from '@/components/DemoBanner';
import { useDemoSession } from '@/contexts/DemoSessionContext';

export default function DemoLeaderboardsPage() {
  const { weekendOf, partyRankings, hostRankings } = useDemoSession();

  return (
    <AppShell>
      <DemoBanner weekendOf={weekendOf} />
      <RankingsView snapshotParties={partyRankings} snapshotHosts={hostRankings} />
    </AppShell>
  );
}
