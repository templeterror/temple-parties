'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { usePathname } from 'next/navigation';
import Header from '@/components/Header';
import MapView from '@/components/MapView';
import RatingModal from '@/components/RatingModal';
import Toast from '@/components/Toast';
import AppShell from '@/components/AppShell';
import PageSkeleton from '@/components/PageSkeleton';
import RequireOnboarding from '@/components/RequireOnboarding';
import { getDefaultDay } from '@/utils/dateHelpers';
import type { PartyDay } from '@/lib/types';
import useGoingStatus from '@/hooks/useGoingStatus';
import useRatingStatus from '@/hooks/useRatingStatus';
import useParties from '@/hooks/useParties';
import useToast from '@/hooks/useToast';
import useModalState from '@/hooks/useModalState';
import useAddressVisibility from '@/hooks/useAddressVisibility';
import { trackEvent } from '@/utils/analytics';
import { useAuth } from '@/contexts/AuthContext';

export default function MapPage() {
  const { isAuthenticated, isLoading: authLoading, needsOnboarding } = useAuth();
  const pathname = usePathname();
  const [selectedDay] = useState<PartyDay>(() => getDefaultDay());
  const [isHydrated, setIsHydrated] = useState(false);
  const [ratingModalParty, setRatingModalParty] = useState<{ id: string; title: string; host: string } | null>(null);
  // Deep-link pan from the party page's map button (/map?party=<id>).
  // Read from window.location after hydration instead of useSearchParams()
  // so this statically-rendered page doesn't need a Suspense boundary.
  const [focusPartyId, setFocusPartyId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const { goingParties, isGoing, getCount, toggleGoing, ensureGoing } = useGoingStatus();
  const { getUserRating, getLikePercentage, getRatingCount, submitRating } = useRatingStatus();
  const { revealAddress } = useAddressVisibility();
  const { allParties, topPartyIds, thursdayDate, fridayDate, saturdayDate, isLoadingParties } = useParties(selectedDay, getCount);
  const toast = useToast();
  const showToast = toast.show;
  const { requireAuthForGoing, requireAuthForRating, replayPendingAuthAction } = useModalState(isAuthenticated, toggleGoing);

  const replayedRef = useRef(false);
  useEffect(() => {
    if (authLoading || !isAuthenticated || needsOnboarding || replayedRef.current) return;
    replayedRef.current = true;
    void replayPendingAuthAction();
  }, [authLoading, isAuthenticated, needsOnboarding, replayPendingAuthAction]);

  useEffect(() => {
    setFocusPartyId(new URLSearchParams(window.location.search).get('party'));
    setIsHydrated(true);
    setSheetOpen(false);
  }, [pathname]);

  const handleGoingClick = useCallback(async (partyId: string) => {
    if (requireAuthForGoing(partyId)) return;
    revealAddress(partyId);
    const wasGoing = isGoing(partyId);
    await toggleGoing(partyId);
    trackEvent('going_toggled', { partyId, action: wasGoing ? 'unmarked' : 'marked', source: 'map' });
  }, [toggleGoing, isGoing, revealAddress, requireAuthForGoing]);

  const handleNavigateClick = useCallback((partyId: string) => {
    if (requireAuthForGoing(partyId)) return;
    revealAddress(partyId);
    void ensureGoing(partyId);
    trackEvent('navigate_clicked', { partyId, source: 'map' });
  }, [ensureGoing, revealAddress, requireAuthForGoing]);

  const handleStarClick = useCallback((partyId: string, title: string, host: string, ratingActive: boolean, ratingLocked: boolean) => {
    if (requireAuthForRating('/map')) return;
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
    trackEvent('party_rated', { partyId: ratingModalParty.id, rating, source: 'map_modal' });
  }, [ratingModalParty, submitRating]);

  const handleSheetOpenChange = useCallback((open: boolean) => {
    setSheetOpen(open);
  }, []);

  if (!isHydrated) {
    return (
      <AppShell mapMode>
        <PageSkeleton />
      </AppShell>
    );
  }

  return (
    <AppShell mapMode hideBottomNav={sheetOpen}>
      <RequireOnboarding>
      <div className="h-screen lg:h-[calc(100vh-4rem)] flex flex-col">
        <Header title="Party Map" />
        <div className={`flex-1 lg:pb-0 ${sheetOpen ? '' : 'pb-[calc(var(--dock-footprint)+0.5rem)]'}`}>
          {isLoadingParties ? (
            <div className="flex justify-center items-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
            </div>
          ) : (
            <MapView
              parties={allParties}
              topPartyIds={topPartyIds}
              userGoingParties={goingParties}
              onGoingClick={handleGoingClick}
              onNavigateClick={handleNavigateClick}
              onRateClick={handleStarClick}
              thursdayDate={thursdayDate}
              fridayDate={fridayDate}
              saturdayDate={saturdayDate}
              focusPartyId={focusPartyId}
              onSheetOpenChange={handleSheetOpenChange}
            />
          )}
        </div>
      </div>

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

      <Toast
        message={toast.message}
        isVisible={toast.isVisible}
        onClose={toast.hide}
      />
      </RequireOnboarding>
    </AppShell>
  );
}
