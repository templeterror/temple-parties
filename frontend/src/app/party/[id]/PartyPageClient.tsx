'use client';

/**
 * Party page — the full story of one party on a pushed route: the mobile
 * Dock is swapped for a sticky action bar, so `I'm going` / `Buy tickets`,
 * directions and share stay one thumb away at any scroll depth.
 *
 * The presentation is components/party/PartyPageView (DESIGN.md "Party
 * page → Deck"); this file owns data and every rule: fetch + refetch on
 * auth flip, pending-auth replay, the server's own vote as a seed, the
 * going / navigate / buy / rate / share / promo / map handlers, analytics,
 * and the InviteModal after a first RSVP.
 *
 * Soft gate: logged-out visitors see everything EXCEPT the address and the
 * promo code (the server nulls them, plus the counts) — the Where row
 * becomes the page's one "Sign in with your .edu" gate. Browse stays free;
 * the address is the carrot.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import AppShell from '@/components/AppShell';
import InviteModal from '@/components/InviteModal';
import Toast from '@/components/Toast';
import RequireOnboarding from '@/components/RequireOnboarding';
import PartyPageView from '@/components/party/PartyPageView';
import { partiesApi, ratingsApi } from '@/services/api';
import type { Party } from '@/lib/types';
import useGoingStatus from '@/hooks/useGoingStatus';
import useRatingStatus from '@/hooks/useRatingStatus';
import useModalState from '@/hooks/useModalState';
import useToast from '@/hooks/useToast';
import { useAuth } from '@/contexts/AuthContext';
import { openMapsDirections, shareContent } from '@/utils/shareHelpers';
import { buildPartyPage } from '@/utils/partyPage';
import { trackEvent } from '@/utils/analytics';

export default function PartyPage() {
  const params = useParams();
  const router = useRouter();
  const partyId = typeof params.id === 'string' ? params.id : '';
  const { isAuthenticated, isLoading: authLoading, needsOnboarding } = useAuth();
  const { isGoing, getCount, toggleGoing, ensureGoing } = useGoingStatus();
  const { getUserRating, getLikePercentage, getRatingCount, submitRating } = useRatingStatus();
  const toast = useToast();
  const showToast = toast.show;
  const modals = useModalState(isAuthenticated, toggleGoing);
  const {
    requireAuthForGoing,
    requireAuthForRating,
    openLogin,
    showInviteModal,
    closeInviteModal,
    openInviteModal,
    replayPendingAuthAction,
  } = modals;

  const [party, setParty] = useState<Party | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  // Your past rating, from the server. useRatingStatus only knows about
  // ratings submitted THIS session, so without this a reload would show
  // outline thumbs even though you already voted.
  const [serverUserRating, setServerUserRating] = useState<number | null>(null);

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
    if (!partyId || !isAuthenticated) {
      setServerUserRating(null);
      return;
    }
    let cancelled = false;
    ratingsApi
      .getPartyRating(partyId)
      .then((r) => {
        if (!cancelled) setServerUserRating(r.userRating ?? null);
      })
      .catch(() => {
        // Decorative — the page works fine without the seed.
      });
    return () => {
      cancelled = true;
    };
  }, [partyId, isAuthenticated]);

  // Refetch when auth flips: the server reveals address/counts to signed-in
  // viewers, so the same party ID returns more data after login.
  useEffect(() => {
    if (!partyId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await partiesApi.getParty(partyId);
        if (!cancelled) setParty(data);
      } catch {
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [partyId, isAuthenticated]);

  const handleGoing = useCallback(async () => {
    if (!party) return;
    if (requireAuthForGoing(party.id, `/party/${party.id}`)) return;
    const wasGoing = isGoing(party.id);
    await toggleGoing(party.id);
    trackEvent('going_toggled', { partyId: party.id, action: wasGoing ? 'unmarked' : 'marked', source: 'party_page' });
    if (!wasGoing) openInviteModal();
  }, [party, requireAuthForGoing, isGoing, toggleGoing, openInviteModal]);

  const handleNavigate = useCallback(async () => {
    if (!party?.address) {
      if (!isAuthenticated) openLogin(undefined, `/party/${partyId}`);
      return;
    }
    if (requireAuthForGoing(party.id, `/party/${party.id}`)) return;
    // Navigating implies attending — keep the v1 auto-RSVP behavior.
    void ensureGoing(party.id);
    openMapsDirections(party.address);
    trackEvent('navigate_clicked', { partyId: party.id, source: 'party_page' });
  }, [party, partyId, isAuthenticated, openLogin, requireAuthForGoing, ensureGoing]);

  // Buying a ticket implies attending — the same silent auto-RSVP rule as
  // navigate, so the GOING count reflects buyers without an extra tap (no
  // toast, no invite modal). Logged-out visitors pass straight through to
  // the ticket page: hijacking a purchase with a login redirect would cost
  // the host a sale. The <a> itself still opens the ticket URL.
  const handleBuyTickets = useCallback(() => {
    if (!party) return;
    trackEvent('buy_tickets_clicked', { partyId: party.id });
    if (isAuthenticated) void ensureGoing(party.id);
  }, [party, isAuthenticated, ensureGoing]);

  // Inline thumbs submit directly — the party page IS the context, no modal.
  const handleRate = useCallback(async (rating: 1 | 0) => {
    if (!party) return;
    if (requireAuthForRating(`/party/${party.id}`)) return;
    if (!party.ratingOpen) {
      toast.show('Ratings unlock when doors open');
      return;
    }
    if (party.ratingLocked) {
      toast.show('Ratings are now closed');
      return;
    }
    // Server enforces the going-only gate too; checking here just gives a
    // friendlier message than a raw 403.
    if (!isGoing(party.id)) {
      toast.show('Ratings are for people who went — tap GOING first');
      return;
    }
    await submitRating(party.id, rating);
    trackEvent('party_rated', { partyId: party.id, rating, source: 'party_page' });
  }, [party, requireAuthForRating, isGoing, submitRating, toast]);

  const handleShare = useCallback(async (surface: string) => {
    if (!party) return;
    const result = await shareContent(party);
    trackEvent('party_shared', { method: result.method, success: result.success, partyId: party.id, surface });
    if (result.success && result.method === 'clipboard') {
      toast.show('Link copied to clipboard!');
    }
  }, [party, toast]);

  const handlePromoCopied = useCallback((code: string) => {
    toast.show('Promo code copied');
    trackEvent('promo_code_copied', { partyId: party?.id, code });
  }, [party, toast]);

  // Logged-out viewers see the promo's label but no code — the one gate's
  // Sign in routes through login and back to this party (address + code).
  const handlePromoSignIn = useCallback(() => {
    trackEvent('promo_signin_clicked', { partyId: party?.id });
    openLogin(undefined, `/party/${partyId}`);
  }, [party?.id, partyId, openLogin]);

  // Jump to the Map tab focused on this party's pin (spatial context lives
  // there — this page deliberately has no embedded map).
  const handleOpenMap = useCallback(() => {
    if (!party) return;
    trackEvent('party_map_opened', { partyId: party.id });
    router.push(`/map?party=${party.id}`);
  }, [party, router]);

  if (loading) {
    return (
      <AppShell hideBottomNav>
        <div className="flex justify-center py-24">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-temple-purple" />
        </div>
      </AppShell>
    );
  }

  if (notFound || !party) {
    return (
      <AppShell hideBottomNav>
        <div className="pb-24 max-w-xl mx-auto px-6 pt-10">
          <h1 className="text-white text-2xl font-montserrat font-semibold mb-4">Party not found</h1>
          <Link href="/" className="text-temple-purple font-montserrat font-semibold underline">
            Back to Home
          </Link>
        </div>
      </AppShell>
    );
  }

  // null-through rule (same as the feed): server-stripped counts stay null so
  // the UI shows dashes for logged-out viewers instead of fake zeros.
  const goingCount = party.goingCount === null ? null : getCount(party.id, party.goingCount);
  const likePct = party.likePercentage === null ? null : getLikePercentage(party.id, party.likePercentage);
  const ratingCount = party.ratingCount === null ? null : getRatingCount(party.id, party.ratingCount);
  // This session's tap wins; otherwise fall back to the server-known vote.
  const userRating = getUserRating(party.id) ?? serverUserRating;
  const userIsGoing = isGoing(party.id);

  // The page model reads the party with the live overlay applied. "Now" is
  // real time (phase in ET); #1 is the server's isHeadliner (top going
  // count of its night).
  const model = buildPartyPage({
    party: { ...party, goingCount, likePercentage: likePct, ratingCount },
    now: new Date(),
    isTop: !!party.isHeadliner,
  });

  return (
    <AppShell hideBottomNav>
      <RequireOnboarding>
        <PartyPageView
          party={party}
          model={model}
          backHref="/"
          isGoing={userIsGoing}
          userRating={userRating}
          onGoing={handleGoing}
          onNavigate={handleNavigate}
          onBuyTickets={handleBuyTickets}
          onRate={handleRate}
          onShare={handleShare}
          onPromoCopied={handlePromoCopied}
          // The one gate unlocks the address and the promo code together;
          // when there's a promo the tap keeps its promo_signin_clicked event.
          onSignIn={party.promoLabel ? handlePromoSignIn : () => openLogin(undefined, `/party/${party.id}`)}
          onOpenMap={handleOpenMap}
          onShowToast={toast.show}
        />

        <InviteModal
          isOpen={showInviteModal}
          onClose={closeInviteModal}
          onShare={() => handleShare('invite_modal')}
          party={party}
        />

        <Toast message={toast.message} isVisible={toast.isVisible} onClose={toast.hide} />
      </RequireOnboarding>
    </AppShell>
  );
}
