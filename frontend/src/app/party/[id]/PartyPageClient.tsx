'use client';

/**
 * Party detail page (WF-D) — the full story of one party, on a pushed route:
 * back arrow instead of the tab bar, and a sticky action bar pinned to the
 * bottom so GOING / navigate stay one thumb away at any scroll depth.
 *
 * Top to bottom: stage hero (poster + back) → category tag → title →
 * host credibility row → date/time → cover / going / SHARE tiles → promo
 * code (the attribution coupon) → address + navigate (or the sign-in gate)
 * → host's description → the "WAS IT GOOD?" rating module → sticky
 * actions. The sticky
 * bar is primary-action + navigate: ticketed parties (WF-D2) put
 * BUY TICKETS in the primary slot (GOING lives on the feed card for those),
 * everyone else gets GOING there.
 *
 * Soft gate: logged-out visitors see everything EXCEPT the address (the
 * server nulls it, plus the counts) — the address module becomes the
 * "SIGN IN WITH .EDU" card. Browse stays free; the address is the carrot.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import AppShell from '@/components/AppShell';
import GoingButton from '@/components/GoingButton';
import InviteModal from '@/components/InviteModal';
import Toast from '@/components/Toast';
import RequireOnboarding from '@/components/RequireOnboarding';
import PartyHero from '@/components/party/PartyHero';
import HostRow from '@/components/party/HostRow';
import WhenWhereCard from '@/components/party/WhenWhereCard';
import PromoCard from '@/components/party/PromoCard';
import RatingPanel from '@/components/party/RatingPanel';
import Pill from '@/components/ui/Pill';
import StatTile from '@/components/ui/StatTile';
import SectionLabel from '@/components/ui/SectionLabel';
import StickyActionBar from '@/components/ui/StickyActionBar';
import NavigateIcon from '@/components/ui/NavigateIcon';
import ShareIcon from '@/components/ui/ShareIcon';
import { ratingWindowState } from '@/components/PartyCard';
import { partiesApi, ratingsApi } from '@/services/api';
import type { Party } from '@/lib/types';
import useGoingStatus from '@/hooks/useGoingStatus';
import useRatingStatus from '@/hooks/useRatingStatus';
import useModalState from '@/hooks/useModalState';
import useToast from '@/hooks/useToast';
import { useAuth } from '@/contexts/AuthContext';
import { openMapsDirections, shareContent } from '@/utils/shareHelpers';
import { coverTileValue } from '@/utils/coverPrice';
import { displayDoorTime, getPartyDateLabel } from '@/utils/dateHelpers';
import { voteCounts } from '@/utils/ratingHelpers';
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

  // Logged-out viewers see the coupon's label but a masked code — SIGN IN
  // routes through login and back to this party (same soft-gate as address).
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
  const votes = voteCounts(likePct, ratingCount);
  const userIsGoing = isGoing(party.id);
  const ticketed = !!party.ticketUrl;

  const windowState = ratingWindowState(party.ratingOpen ?? false, party.ratingLocked ?? false);
  // The going-only rule is enforced server-side and surfaced as a toast on
  // attempt (see handleRate) — no need to preach it on the panel itself.
  const ratingLockCopy =
    windowState === 'locked'
      ? 'Ratings are closed'
      : windowState === 'inactive'
        ? `Unlocks at ${displayDoorTime(party.doorsOpen)}`
        : null;

  const hostSubtitle = party.hostStats
    ? `${party.category} · ${party.hostStats.partiesHosted} ${party.hostStats.partiesHosted === 1 ? 'party' : 'parties'} hosted · ↑ ${Math.round(party.hostStats.avgLikePercentage)}% avg`
    : undefined;

  return (
    <AppShell hideBottomNav>
      <RequireOnboarding>
        {/* pb-32 clears the sticky action bar so the last module isn't hidden under it. */}
        <div className="pb-32 lg:pb-32 max-w-xl mx-auto">
          <PartyHero posterImage={party.posterImage} title={party.title} />

          <div className="flex flex-col gap-3.5 px-4 pt-4 sm:px-6">
            {/* Tag row. The announcements bell from the design lands with the
                Phase 2 announcements feature — nothing to ring yet. */}
            <div className="flex items-center gap-2">
              {party.isHeadliner && (
                <Pill tone="hyped" size="sm" shape="square" title="Tonight's most popular party">
                  HEADLINER
                </Pill>
              )}
              <Pill tone="accent" size="sm" shape="square">{party.category}</Pill>
            </div>

            <h1 className="text-white text-[28px] leading-8 font-montserrat font-bold uppercase">
              {party.title}
            </h1>

            <HostRow
              name={party.host}
              isVerified={party.isVerified}
              subtitle={hostSubtitle}
              avatarUrl={party.hostStats?.logoUrl}
              onShowToast={toast.show}
            />

            <WhenWhereCard
              dateLabel={getPartyDateLabel(party.date)}
              doorsOpen={party.doorsOpen}
              doorsClose={party.doorsClose}
              address={party.address}
              onUnlock={() => openLogin(undefined, `/party/${party.id}`)}
              onOpenMap={handleOpenMap}
            />

            <div className="flex gap-2.5">
              {/* Always FREE / $N / — / ONLINE, never the host's prose
                  (utils/coverPrice.ts reads the amount out of "$10 at the
                  door"). No readable price: a ticketed party says ONLINE (the
                  link knows the price), a plain one says FREE. "FREE /
                  TICKETS" next to a BUY TICKETS bar would be a lie. */}
              <StatTile
                value={coverTileValue(party.ticketPrice, ticketed)}
                label={ticketed ? 'TICKETS' : 'COVER'}
              />
              <StatTile value={goingCount === null ? '—' : String(goingCount)} label="GOING" />
              <button
                type="button"
                onClick={() => handleShare('cta')}
                aria-label="Share this party"
                className="flex-1 min-w-0 flex flex-col items-center justify-center gap-[3px] py-3 rounded-[12px] bg-temple-purple-light text-black hover:opacity-90 active:scale-[0.98] transition-all duration-150"
              >
                <ShareIcon className="w-4 h-4" />
                <span className="font-montserrat font-bold text-[9px] tracking-[0.9px] uppercase">
                  SHARE
                </span>
              </button>
            </div>

            {/* Renders on the label alone: for logged-out viewers the server
                strips promoCode to null, and the card shows its gated state
                (masked code + SIGN IN) instead of disappearing. */}
            {party.promoLabel && (
              <PromoCard
                code={party.promoCode}
                label={party.promoLabel}
                hint={party.promoHint}
                onCopied={handlePromoCopied}
                onSignIn={handlePromoSignIn}
              />
            )}

            {party.description && (
              <div className="flex flex-col gap-1.5">
                <SectionLabel className="!text-[10px] !tracking-[1px]">FROM THE HOST</SectionLabel>
                <p className="font-montserrat text-[13px] leading-[19px] text-white/70 whitespace-pre-wrap">
                  {party.description}
                </p>
              </div>
            )}

            <RatingPanel
              likePercentage={likePct}
              likeCount={votes?.likeCount ?? null}
              dislikeCount={votes?.dislikeCount ?? null}
              userRating={userRating}
              state={windowState}
              lockCopy={ratingLockCopy}
              onRate={handleRate}
            />
          </div>
        </div>

        {/* Sticky actions — one anatomy for every party: a 70/30 split where
            both actions fill the bar's full height. The primary (purple) slot
            is the party's ONE main action: BUY TICKETS when the party sells
            tickets, GOING otherwise. Navigate keeps its light-purple seat
            on the right. Ticketed parties still take GOING taps from the
            feed card. */}
        <StickyActionBar>
          <div className="flex-[7] min-w-0 flex">
            {ticketed ? (
              <a
                href={party.ticketUrl!}
                target="_blank"
                rel="noopener noreferrer"
                onClick={handleBuyTickets}
                className="flex-1 min-w-0 py-3 rounded-[10px] bg-temple-purple text-white font-montserrat font-bold text-[14px] uppercase text-center hover:opacity-90 active:scale-[0.98] transition-all duration-150"
              >
                BUY TICKETS ↗
              </a>
            ) : (
              <GoingButton
                currentCount={goingCount}
                userIsGoing={userIsGoing}
                onGoingClick={handleGoing}
                variant="bar"
              />
            )}
          </div>
          <button
            type="button"
            onClick={handleNavigate}
            aria-label="Navigate"
            title="Opens walking directions"
            className="flex-[3] py-3 rounded-[10px] bg-temple-purple-light text-temple-purple flex items-center justify-center hover:opacity-90 active:scale-[0.98] transition-all duration-150"
          >
            <NavigateIcon className="w-[18px] h-[18px]" />
          </button>
        </StickyActionBar>

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
