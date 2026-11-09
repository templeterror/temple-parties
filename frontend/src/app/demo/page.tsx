'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Header from '@/components/Header';
import DayTabs from '@/components/DayTabs';
import PartyDeck from '@/components/feed/PartyDeck';
import InviteModal from '@/components/InviteModal';
import EmptyState from '@/components/EmptyState';
import Toast from '@/components/Toast';
import AppShell from '@/components/AppShell';
import DemoBanner from '@/components/DemoBanner';
import { getDefaultDay, pickSmartDefaultDay } from '@/utils/dateHelpers';
import { shareContent } from '@/utils/shareHelpers';
import useToast from '@/hooks/useToast';
import { useDemoParties } from '@/contexts/DemoSessionContext';
import { useDemoMode } from '@/contexts/DemoModeContext';
import { partyHref } from '@/lib/authHelpers';
// SPONSOR (disabled by owner 2026-11-07 — restore by uncommenting this import and the `sponsor` prop on PartyDeck below):
// import { PRIMARY_SPONSOR } from '@/lib/sponsors';
import { trackEvent } from '@/utils/analytics';
import type { PartyDay } from '@/lib/types';

export default function DemoHomePage() {
  const demo = useDemoMode();
  const [selectedDay, setSelectedDay] = useState<PartyDay>('friday');
  const [lastGoingPartyId, setLastGoingPartyId] = useState<string | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);

  const {
    weekendOf,
    thursdayDate,
    fridayDate,
    saturdayDate,
    demoNow,
    goingParties,
    isGoing,
    toggleGoing,
    ensureGoing,
    filteredParties,
    parties: allParties,
    dayCounts,
  } = useDemoParties(selectedDay);

  const toast = useToast();
  const showToast = toast.show;

  const hasAppliedSmartDefault = useRef(false);
  useEffect(() => {
    if (hasAppliedSmartDefault.current) return;
    hasAppliedSmartDefault.current = true;
    setSelectedDay(pickSmartDefaultDay(getDefaultDay(demoNow), dayCounts));
  }, [dayCounts, demoNow]);

  const topGoingParty = useMemo(() => {
    if (goingParties.length === 0) return null;
    const sorted = allParties
      .filter((p) => goingParties.includes(p.id))
      .sort((a, b) => (b.goingCount ?? 0) - (a.goingCount ?? 0));
    return sorted.length > 0 ? sorted[0] : null;
  }, [goingParties, allParties]);

  const handleGoingClick = useCallback(
    (partyId: string) => {
      const wasGoing = isGoing(partyId);
      toggleGoing(partyId);
      trackEvent('going_toggled', { partyId, action: wasGoing ? 'unmarked' : 'marked', demo: true });
      if (!wasGoing) {
        setLastGoingPartyId(partyId);
        setShowInviteModal(true);
      }
    },
    [toggleGoing, isGoing],
  );

  const handleNavigateClick = useCallback(
    (partyId: string) => {
      ensureGoing(partyId);
      trackEvent('navigate_clicked', { partyId, demo: true });
    },
    [ensureGoing],
  );

  const handleShare = useCallback(async () => {
    const partyToShare = lastGoingPartyId
      ? allParties.find((p) => p.id === lastGoingPartyId) ?? topGoingParty
      : topGoingParty;
    const result = await shareContent(
      partyToShare || undefined,
      partyToShare ? { path: partyHref(partyToShare.id, demo) } : undefined,
    );
    trackEvent('party_shared', {
      method: result.method,
      success: result.success,
      partyId: partyToShare?.id,
      demo: true,
    });
    if (result.success && result.method === 'clipboard') {
      showToast('Link copied to clipboard!');
    }
  }, [lastGoingPartyId, allParties, topGoingParty, showToast, demo]);

  return (
    <AppShell>
      <div className="pb-[var(--dock-clearance)] lg:pb-8">
        <Header />
        <DemoBanner weekendOf={weekendOf} />

        <DayTabs
          selectedDay={selectedDay}
          onDayChange={setSelectedDay}
          thursdayDate={thursdayDate}
          fridayDate={fridayDate}
          saturdayDate={saturdayDate}
        />

        {filteredParties.length === 0 ? (
          <div className="max-w-xl mx-auto px-4 sm:px-6">
            <EmptyState selectedDay={selectedDay} leaderboardsHref="/demo/leaderboards" />
          </div>
        ) : (
          // Frozen clock (demoNow) and local-only RSVPs; the deck's own
          // analytics are tagged demo: true via readOnly.
          <PartyDeck
            parties={filteredParties}
            day={selectedDay}
            now={demoNow}
            isGoing={isGoing}
            loggedOut={false}
            onGoingClick={handleGoingClick}
            onNavigateClick={handleNavigateClick}
            /* SPONSOR SLIDE — disabled by owner 2026-11-07, restore by uncommenting:
            sponsor={PRIMARY_SPONSOR}
            */
            readOnly
          />
        )}
      </div>

      <InviteModal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        onShare={handleShare}
        party={lastGoingPartyId ? allParties.find((p) => p.id === lastGoingPartyId) ?? null : null}
      />

      <Toast message={toast.message} isVisible={toast.isVisible} onClose={toast.hide} />
    </AppShell>
  );
}
