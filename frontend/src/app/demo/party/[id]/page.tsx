'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import AppShell from '@/components/AppShell';
import InviteModal from '@/components/InviteModal';
import Toast from '@/components/Toast';
import DemoBanner from '@/components/DemoBanner';
import PartyPageView from '@/components/party/PartyPageView';
import { useDemoSession } from '@/contexts/DemoSessionContext';
import { useDemoMode } from '@/contexts/DemoModeContext';
import useToast from '@/hooks/useToast';
import { openMapsDirections, shareContent } from '@/utils/shareHelpers';
import { buildPartyPage } from '@/utils/partyPage';
import { trackEvent } from '@/utils/analytics';
import { partyHref } from '@/lib/authHelpers';

/**
 * Demo twin of the party page — the same PartyPageView, driven by the
 * read-only demo session: RSVPs and votes live in local session state
 * (useDemoSession), never the API, and the clock is the frozen demo night
 * (`demoNow`, Fri 11:30 PM ET), so Friday reads live, Saturday upcoming and
 * Thursday ended.
 */
export default function DemoPartyPage() {
  const params = useParams();
  const router = useRouter();
  const partyId = typeof params.id === 'string' ? params.id : '';
  const demo = useDemoMode();
  const {
    weekendOf,
    demoNow,
    topPartyIds,
    partyById,
    isGoing,
    toggleGoing,
    ensureGoing,
    getUserRating,
    submitRating,
  } = useDemoSession();
  const toast = useToast();
  const [showInviteModal, setShowInviteModal] = useState(false);

  const party = partyById(partyId);

  const handleGoing = useCallback(() => {
    if (!party) return;
    const wasGoing = isGoing(party.id);
    toggleGoing(party.id);
    trackEvent('going_toggled', {
      partyId: party.id,
      action: wasGoing ? 'unmarked' : 'marked',
      source: 'party_page',
      demo: true,
    });
    if (!wasGoing) setShowInviteModal(true);
  }, [party, isGoing, toggleGoing]);

  const handleNavigate = useCallback(() => {
    if (!party?.address) return;
    ensureGoing(party.id);
    openMapsDirections(party.address);
    trackEvent('navigate_clicked', { partyId: party.id, source: 'party_page', demo: true });
  }, [party, ensureGoing]);

  const handleBuyTickets = useCallback(() => {
    if (!party) return;
    trackEvent('buy_tickets_clicked', { partyId: party.id, demo: true });
    ensureGoing(party.id);
  }, [party, ensureGoing]);

  const handleRate = useCallback(
    (rating: 1 | 0) => {
      if (!party) return;
      if (!isGoing(party.id)) {
        toast.show('Ratings are for people who went — tap GOING first');
        return;
      }
      submitRating(party.id, rating);
      trackEvent('party_rated', { partyId: party.id, rating, source: 'party_page', demo: true });
    },
    [party, isGoing, submitRating, toast],
  );

  const handleShare = useCallback(
    async (surface: string) => {
      if (!party) return;
      const result = await shareContent(party, { path: partyHref(party.id, demo) });
      trackEvent('party_shared', {
        method: result.method,
        success: result.success,
        partyId: party.id,
        surface,
        demo: true,
      });
      if (result.success && result.method === 'clipboard') {
        toast.show('Link copied to clipboard!');
      }
    },
    [party, demo, toast],
  );

  const handlePromoCopied = useCallback(
    (code: string) => {
      toast.show('Promo code copied');
      trackEvent('promo_code_copied', { partyId: party?.id, code, demo: true });
    },
    [party?.id, toast],
  );

  const handleOpenMap = useCallback(() => {
    if (!party) return;
    trackEvent('party_map_opened', { partyId: party.id, demo: true });
    router.push(`/demo/map?party=${party.id}`);
  }, [party, router]);

  if (!party) {
    return (
      <AppShell hideBottomNav>
        <div className="pb-24 max-w-xl mx-auto px-6 pt-10">
          <h1 className="text-white text-2xl font-montserrat font-semibold mb-4">Party not found</h1>
          <Link href="/demo" className="text-temple-purple font-montserrat font-semibold underline">
            Back to Demo
          </Link>
        </div>
      </AppShell>
    );
  }

  // Demo counts always exist (the snapshot has them, with your local RSVP /
  // vote overlaid by the demo session). The rating window is held open, as
  // it always has been in the demo; the clock is the frozen demo night.
  const goingCount = party.goingCount ?? 0;
  const likePct = party.likePercentage ?? 0;
  const ratingCount = party.ratingCount ?? 0;
  const model = buildPartyPage({
    party: { ...party, goingCount, likePercentage: likePct, ratingCount, ratingOpen: true, ratingLocked: false },
    now: demoNow,
    isTop: topPartyIds[party.day] === party.id,
  });

  return (
    <AppShell hideBottomNav>
      <PartyPageView
        party={party}
        model={model}
        backHref="/demo"
        isGoing={isGoing(party.id)}
        userRating={getUserRating(party.id)}
        banner={
          <div className="pt-2">
            <DemoBanner weekendOf={weekendOf} />
          </div>
        }
        onGoing={handleGoing}
        onNavigate={handleNavigate}
        onBuyTickets={handleBuyTickets}
        onRate={handleRate}
        onShare={handleShare}
        onPromoCopied={handlePromoCopied}
        // Demo parties always carry an address, so the gate never shows.
        onSignIn={() => undefined}
        onOpenMap={handleOpenMap}
        onShowToast={toast.show}
      />

      <InviteModal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        onShare={() => handleShare('invite_modal')}
        party={party}
      />

      <Toast message={toast.message} isVisible={toast.isVisible} onClose={toast.hide} />
    </AppShell>
  );
}
