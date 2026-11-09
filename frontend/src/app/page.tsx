'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Header from '@/components/Header';
import DayTabs from '@/components/DayTabs';
import PartyDeck from '@/components/feed/PartyDeck';
import PartyDeckSkeleton from '@/components/feed/PartyDeckSkeleton';
import InviteModal from '@/components/InviteModal';
import RatingReminderModal from '@/components/RatingReminderModal';
import EmptyState from '@/components/EmptyState';
import Toast from '@/components/Toast';
import AppShell from '@/components/AppShell';
import PageSkeleton from '@/components/PageSkeleton';
import RequireOnboarding from '@/components/RequireOnboarding';
import { getDefaultDay, pickSmartDefaultDay } from '@/utils/dateHelpers';
import { shareContent } from '@/utils/shareHelpers';
import useGoingStatus from '@/hooks/useGoingStatus';
import useRatingStatus from '@/hooks/useRatingStatus';
import useParties from '@/hooks/useParties';
import useToast from '@/hooks/useToast';
import useModalState from '@/hooks/useModalState';
import useAddressVisibility from '@/hooks/useAddressVisibility';
import useRatingReminder from '@/hooks/useRatingReminder';
import { trackEvent } from '@/utils/analytics';
import { useAuth } from '@/contexts/AuthContext';
// SPONSOR (disabled by owner 2026-11-07 — restore by uncommenting this import and the `sponsor` prop on PartyDeck below):
// import { PRIMARY_SPONSOR } from '@/lib/sponsors';
import type { PartyDay } from '@/lib/types';

/** The deck's live/ended labels follow the real clock; a minute is fine-grained enough. */
const CLOCK_TICK_MS = 60_000;

export default function HomePage() {
  const { isAuthenticated, isLoading: authLoading, needsOnboarding } = useAuth();
  const [selectedDay, setSelectedDay] = useState<PartyDay>(() => getDefaultDay());
  const [isHydrated, setIsHydrated] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [lastGoingPartyId, setLastGoingPartyId] = useState<string | null>(null);

  const { goingParties, isGoing, getCount, toggleGoing, ensureGoing } = useGoingStatus();
  const { getUserRating, getLikePercentage, getRatingCount, submitRating } = useRatingStatus();
  const { revealAddress } = useAddressVisibility();
  const {
    filteredParties,
    allParties,
    isLoadingParties,
    dayCounts,
    thursdayDate,
    fridayDate,
    saturdayDate,
  } = useParties(selectedDay, getCount);
  const toast = useToast();
  const { currentPrompt, dismissPrompt } = useRatingReminder(
    allParties, goingParties, getUserRating, isHydrated, isLoadingParties,
  );
  const modals = useModalState(isAuthenticated, toggleGoing);
  const showToast = toast.show;
  const {
    openInviteModal,
    showInviteModal,
    closeInviteModal,
    openLogin,
    requireAuthForGoing,
    replayPendingAuthAction,
  } = modals;

  const replayedRef = useRef(false);
  useEffect(() => {
    if (authLoading || !isAuthenticated || needsOnboarding || replayedRef.current) return;
    replayedRef.current = true;
    void (async () => {
      const action = await replayPendingAuthAction();
      if (action?.type === 'going') {
        showToast("You're marked as going!");
      }
    })();
  }, [authLoading, isAuthenticated, needsOnboarding, replayPendingAuthAction, showToast]);

  useEffect(() => {
    setSelectedDay(getDefaultDay());
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), CLOCK_TICK_MS);
    return () => window.clearInterval(id);
  }, []);

  const hasAppliedSmartDefault = useRef(false);
  useEffect(() => {
    if (isLoadingParties || hasAppliedSmartDefault.current) return;
    hasAppliedSmartDefault.current = true;
    setSelectedDay(pickSmartDefaultDay(getDefaultDay(), dayCounts));
  }, [isLoadingParties, dayCounts]);

  const handleDayChange = useCallback((day: PartyDay) => {
    setSelectedDay(day);
    trackEvent('day_tab_switched', { day });
  }, []);

  const topGoingParty = (() => {
    if (goingParties.length === 0) return null;
    const goingPartiesSorted = allParties
      .filter(party => goingParties.includes(party.id))
      .sort((a, b) => (b.goingCount ?? 0) - (a.goingCount ?? 0));
    return goingPartiesSorted.length > 0 ? goingPartiesSorted[0] : null;
  })();

  const handleGoingClick = useCallback(async (partyId: string) => {
    if (requireAuthForGoing(partyId)) return;
    revealAddress(partyId);
    const wasGoing = isGoing(partyId);
    await toggleGoing(partyId);
    trackEvent('going_toggled', { partyId, action: wasGoing ? 'unmarked' : 'marked' });
    if (!wasGoing) {
      setLastGoingPartyId(partyId);
      openInviteModal();
    }
  }, [toggleGoing, isGoing, openInviteModal, revealAddress, requireAuthForGoing]);

  const handleNavigateClick = useCallback((partyId: string) => {
    if (requireAuthForGoing(partyId)) return;
    revealAddress(partyId);
    void ensureGoing(partyId);
    trackEvent('navigate_clicked', { partyId });
  }, [ensureGoing, revealAddress, requireAuthForGoing]);

  const handleViewAddress = useCallback((partyId: string) => {
    const party = allParties.find((p) => p.id === partyId);
    if (party?.address == null && !isAuthenticated) {
      openLogin(undefined, '/');
      return;
    }
    revealAddress(partyId);
  }, [allParties, isAuthenticated, openLogin, revealAddress]);

  const handleShare = useCallback(async () => {
    const partyToShare = lastGoingPartyId
      ? allParties.find(p => p.id === lastGoingPartyId) ?? topGoingParty
      : topGoingParty;
    const result = await shareContent(partyToShare || undefined);
    trackEvent('party_shared', { method: result.method, success: result.success, partyId: partyToShare?.id });
    if (result.success && result.method === 'clipboard') {
      showToast('Link copied to clipboard!');
    }
  }, [lastGoingPartyId, allParties, topGoingParty, showToast]);

  const handleReminderRate = useCallback(async (rating: number) => {
    if (!currentPrompt) return;
    await submitRating(currentPrompt.id, rating);
    trackEvent('party_rated', { partyId: currentPrompt.id, rating, source: 'reminder' });
  }, [currentPrompt, submitRating]);

  // The deck ranks and renders the night itself. Rating numbers carry the
  // local overlay (they move the moment you rate from the reminder); a
  // server-nulled count stays null (soft-gate) instead of becoming a fake 0.
  const deckParties = useMemo(
    () =>
      filteredParties.map((party) => ({
        ...party,
        likePercentage: party.likePercentage === null ? null : getLikePercentage(party.id, party.likePercentage),
        ratingCount: party.ratingCount === null ? null : getRatingCount(party.id, party.ratingCount),
      })),
    [filteredParties, getLikePercentage, getRatingCount],
  );

  if (!isHydrated) {
    return (
      <AppShell>
        <PageSkeleton deck />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <RequireOnboarding>
      <div className="pb-[var(--dock-clearance)] lg:pb-8">
        <Header />

        <DayTabs
          selectedDay={selectedDay}
          onDayChange={handleDayChange}
          thursdayDate={thursdayDate}
          fridayDate={fridayDate}
          saturdayDate={saturdayDate}
        />

        {isLoadingParties ? (
          <PartyDeckSkeleton />
        ) : deckParties.length === 0 ? (
          <div className="max-w-xl mx-auto px-4 sm:px-6">
            <EmptyState selectedDay={selectedDay} />
          </div>
        ) : (
          <PartyDeck
            parties={deckParties}
            day={selectedDay}
            now={now}
            isGoing={isGoing}
            loggedOut={!authLoading && !isAuthenticated}
            onGoingClick={handleGoingClick}
            onNavigateClick={handleNavigateClick}
            onViewAddress={handleViewAddress}
            /* SPONSOR SLIDE — disabled by owner 2026-11-07, restore by uncommenting:
            sponsor={PRIMARY_SPONSOR}
            */
          />
        )}
      </div>

      <InviteModal
        isOpen={showInviteModal}
        onClose={closeInviteModal}
        onShare={handleShare}
      />

      {currentPrompt && (
        <RatingReminderModal
          isOpen={true}
          onClose={dismissPrompt}
          partyTitle={currentPrompt.title}
          partyHost={currentPrompt.host}
          likePercentage={getLikePercentage(currentPrompt.id, 0)}
          ratingCount={getRatingCount(currentPrompt.id, 0)}
          userRating={getUserRating(currentPrompt.id)}
          onRate={handleReminderRate}
          variant={currentPrompt.trigger === '12hr' ? 'nextday' : 'tonight'}
        />
      )}

      <Toast
        message={toast.message}
        isVisible={toast.isVisible}
        onClose={toast.hide}
      />
      </RequireOnboarding>
    </AppShell>
  );
}
