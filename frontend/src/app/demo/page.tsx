'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Header from '@/components/Header';
import DayTabs from '@/components/DayTabs';
import PartyCard from '@/components/PartyCard';
import HeadlinerCard from '@/components/HeadlinerCard';
import SectionLabel from '@/components/ui/SectionLabel';
import InviteModal from '@/components/InviteModal';
import EmptyState from '@/components/EmptyState';
import Toast from '@/components/Toast';
import AppShell from '@/components/AppShell';
import DemoBanner from '@/components/DemoBanner';
import { getAlsoTonightLabel, getDefaultDay, pickSmartDefaultDay } from '@/utils/dateHelpers';
import { shareContent } from '@/utils/shareHelpers';
import useToast from '@/hooks/useToast';
import { useDemoParties } from '@/contexts/DemoSessionContext';
import { useDemoMode } from '@/contexts/DemoModeContext';
import { partyHref } from '@/lib/authHelpers';
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
    getUserRating,
    filteredParties,
    parties: allParties,
    topPartyId,
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

  const headliner = filteredParties.find((p) => p.id === topPartyId) ?? filteredParties[0];
  const rest = headliner ? filteredParties.filter((p) => p.id !== headliner.id) : [];
  const feedCardProps = (party: (typeof filteredParties)[number]) => ({
    id: party.id,
    title: party.title,
    host: party.host,
    category: party.category,
    doorsOpen: party.doorsOpen,
    address: party.address,
    goingCount: party.goingCount,
    isHyped: party.id === topPartyId,
    userIsGoing: isGoing(party.id),
    onGoingClick: handleGoingClick,
    onNavigateClick: handleNavigateClick,
    isAddressVisible: true,
    onViewAddressClick: () => undefined,
    likePercentage: party.likePercentage,
    ratingCount: party.ratingCount,
    userRating: getUserRating(party.id),
    onRateClick: () => undefined,
    isRatingActive: true,
    isRatingLocked: false,
    isVerified: party.isVerified,
    posterImage: party.posterImage,
    onShowToast: showToast,
  });

  return (
    <AppShell>
      <div className="pb-24 lg:pb-8">
        <Header />
        <DemoBanner weekendOf={weekendOf} />

        <DayTabs
          selectedDay={selectedDay}
          onDayChange={setSelectedDay}
          thursdayDate={thursdayDate}
          fridayDate={fridayDate}
          saturdayDate={saturdayDate}
        />

        <div className="max-w-xl mx-auto px-4 sm:px-6">
          {!headliner ? (
            <EmptyState selectedDay={selectedDay} leaderboardsHref="/demo/leaderboards" />
          ) : (
            <>
              <HeadlinerCard {...feedCardProps(headliner)} />
              {rest.length > 0 && (
                <>
                  <SectionLabel className="mb-3 mt-1">
                    {getAlsoTonightLabel(selectedDay, rest.length, demoNow)}
                  </SectionLabel>
                  {rest.map((party) => (
                    <PartyCard key={party.id} {...feedCardProps(party)} />
                  ))}
                </>
              )}
            </>
          )}
        </div>
      </div>

      <InviteModal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        onShare={handleShare}
      />

      <Toast message={toast.message} isVisible={toast.isVisible} onClose={toast.hide} />
    </AppShell>
  );
}
