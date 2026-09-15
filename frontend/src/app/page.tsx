'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Header from '@/components/Header';
import DayTabs from '@/components/DayTabs';
import PartyCard from '@/components/PartyCard';
import HeadlinerCard from '@/components/HeadlinerCard';
import SponsoredSlot from '@/components/SponsoredSlot';
import SectionLabel from '@/components/ui/SectionLabel';
import InviteModal from '@/components/InviteModal';
import RatingModal from '@/components/RatingModal';
import RatingReminderModal from '@/components/RatingReminderModal';
import EmptyState from '@/components/EmptyState';
import Toast from '@/components/Toast';
import AppShell from '@/components/AppShell';
import PageSkeleton from '@/components/PageSkeleton';
import RequireOnboarding from '@/components/RequireOnboarding';
import { getAlsoTonightLabel, getDefaultDay, pickSmartDefaultDay } from '@/utils/dateHelpers';
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
import type { PartyDay } from '@/lib/types';

export default function HomePage() {
  const { isAuthenticated, isLoading: authLoading, needsOnboarding } = useAuth();
  const [selectedDay, setSelectedDay] = useState<PartyDay>(() => getDefaultDay());
  const [isHydrated, setIsHydrated] = useState(false);
  const [ratingModalParty, setRatingModalParty] = useState<{ id: string; title: string; host: string } | null>(null);
  const [lastGoingPartyId, setLastGoingPartyId] = useState<string | null>(null);

  const { goingParties, isGoing, getCount, toggleGoing, ensureGoing } = useGoingStatus();
  const { getUserRating, getLikePercentage, getRatingCount, submitRating } = useRatingStatus();
  const { isAddressVisible, revealAddress } = useAddressVisibility();
  const {
    filteredParties,
    allParties,
    topPartyId,
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
    requireAuthForRating,
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

  const handleStarClick = useCallback((partyId: string, title: string, host: string, ratingActive: boolean, ratingLocked: boolean) => {
    if (requireAuthForRating()) return;
    if (!ratingActive) {
      showToast('Ratings unlock when doors open');
      return;
    }
    if (ratingLocked) {
      showToast('Ratings are now closed');
      return;
    }
    setRatingModalParty({ id: partyId, title, host });
  }, [showToast, requireAuthForRating]);

  const handleModalRate = useCallback(async (rating: number) => {
    if (!ratingModalParty) return;
    await submitRating(ratingModalParty.id, rating);
    trackEvent('party_rated', { partyId: ratingModalParty.id, rating, source: 'modal' });
  }, [ratingModalParty, submitRating]);

  const handleReminderRate = useCallback(async (rating: number) => {
    if (!currentPrompt) return;
    await submitRating(currentPrompt.id, rating);
    trackEvent('party_rated', { partyId: currentPrompt.id, rating, source: 'reminder' });
  }, [currentPrompt, submitRating]);

  // The feed splits into the headliner (the day's top party — HeadlinerCard)
  // and the rest (compact PartyCards). Both cards take the same props, built
  // once here — that's the "wire it up" contract.
  const headliner = filteredParties.find((p) => p.id === topPartyId) ?? filteredParties[0];
  const rest = headliner ? filteredParties.filter((p) => p.id !== headliner.id) : [];
  const feedCardProps = (party: typeof filteredParties[number]) => ({
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
    isAddressVisible: isAddressVisible(party.id),
    onViewAddressClick: handleViewAddress,
    // Soft-gate: when the server nulled the counts (logged out) we pass the
    // null straight through so cards show dashes — the overlay getters would
    // otherwise coerce it to a fake 0.
    likePercentage: party.likePercentage === null ? null : getLikePercentage(party.id, party.likePercentage),
    ratingCount: party.ratingCount === null ? null : getRatingCount(party.id, party.ratingCount),
    userRating: getUserRating(party.id),
    onRateClick: handleStarClick,
    isRatingActive: party.ratingOpen ?? false,
    isRatingLocked: party.ratingLocked ?? false,
    isVerified: party.isVerified,
    posterImage: party.posterImage,
    onShowToast: showToast,
  });

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
      <div className="pb-24 lg:pb-8">
        <Header />

        <DayTabs
          selectedDay={selectedDay}
          onDayChange={handleDayChange}
          thursdayDate={thursdayDate}
          fridayDate={fridayDate}
          saturdayDate={saturdayDate}
        />

        <div className="max-w-xl mx-auto px-4 sm:px-6">
          {isLoadingParties ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-temple-purple" />
            </div>
          ) : !headliner ? (
            <EmptyState selectedDay={selectedDay} />
          ) : (
            <>
              <HeadlinerCard {...feedCardProps(headliner)} />
              <SponsoredSlot />
              {rest.length > 0 && (
                <>
                  <SectionLabel className="mb-3 mt-1">
                    {getAlsoTonightLabel(selectedDay, rest.length)}
                  </SectionLabel>
                  {rest.map((party, index) => (
                    <div
                      key={party.id}
                      style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
                    >
                      <PartyCard {...feedCardProps(party)} />
                    </div>
                  ))}
                </>
              )}
            </>
          )}
        </div>
      </div>

      <InviteModal
        isOpen={showInviteModal}
        onClose={closeInviteModal}
        onShare={handleShare}
        party={lastGoingPartyId ? allParties.find((p) => p.id === lastGoingPartyId) ?? null : null}
      />

      {ratingModalParty && (
        <RatingModal
          isOpen={!!ratingModalParty}
          onClose={() => setRatingModalParty(null)}
          partyTitle={ratingModalParty.title}
          partyHost={ratingModalParty.host}
          likePercentage={getLikePercentage(ratingModalParty.id, 0)}
          ratingCount={getRatingCount(ratingModalParty.id, 0)}
          userRating={getUserRating(ratingModalParty.id)}
          onRate={handleModalRate}
        />
      )}

      {currentPrompt && !ratingModalParty && (
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
