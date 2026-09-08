'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import AppShell from '@/components/AppShell';
import GoingButton from '@/components/GoingButton';
import InviteModal from '@/components/InviteModal';
import Toast from '@/components/Toast';
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
import DemoBanner from '@/components/DemoBanner';
import { ratingWindowState } from '@/components/PartyCard';
import { useDemoSession } from '@/contexts/DemoSessionContext';
import { useDemoMode } from '@/contexts/DemoModeContext';
import useToast from '@/hooks/useToast';
import { openMapsDirections, shareContent } from '@/utils/shareHelpers';
import { coverTileValue } from '@/utils/coverPrice';
import { getPartyDateLabel } from '@/utils/dateHelpers';
import { voteCounts } from '@/utils/ratingHelpers';
import { trackEvent } from '@/utils/analytics';
import { partyHref } from '@/lib/authHelpers';

export default function DemoPartyPage() {
  const params = useParams();
  const router = useRouter();
  const partyId = typeof params.id === 'string' ? params.id : '';
  const demo = useDemoMode();
  const {
    weekendOf,
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

  const goingCount = party.goingCount ?? 0;
  const likePct = party.likePercentage ?? 0;
  const ratingCount = party.ratingCount ?? 0;
  const userRating = getUserRating(party.id);
  const votes = voteCounts(likePct, ratingCount);
  const userIsGoing = isGoing(party.id);
  const ticketed = !!party.ticketUrl;
  const windowState = ratingWindowState(true, false);

  const hostSubtitle = party.hostStats
    ? `${party.category} · ${party.hostStats.partiesHosted} ${party.hostStats.partiesHosted === 1 ? 'party' : 'parties'} hosted · ↑ ${Math.round(party.hostStats.avgLikePercentage)}% avg`
    : undefined;

  return (
    <AppShell hideBottomNav>
      <div className="pb-32 lg:pb-32 max-w-xl mx-auto">
        <div className="pt-2">
          <DemoBanner weekendOf={weekendOf} />
        </div>
        <PartyHero posterImage={party.posterImage} title={party.title} backHref="/demo" />

        <div className="flex flex-col gap-3.5 px-4 pt-4 sm:px-6">
          <div className="flex items-center gap-2">
            {party.isHeadliner && (
              <Pill tone="hyped" size="sm" shape="square" title="Tonight's most popular party">
                HEADLINER
              </Pill>
            )}
            <Pill tone="accent" size="sm" shape="square">
              {party.category}
            </Pill>
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
            onUnlock={() => undefined}
            onOpenMap={handleOpenMap}
          />

          <div className="flex gap-2.5">
            <StatTile
              value={coverTileValue(party.ticketPrice, ticketed)}
              label={ticketed ? 'TICKETS' : 'COVER'}
            />
            <StatTile value={String(goingCount)} label="GOING" />
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

          {party.promoLabel && (
            <PromoCard
              code={party.promoCode}
              label={party.promoLabel}
              hint={party.promoHint}
              onCopied={handlePromoCopied}
              onSignIn={() => undefined}
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
            lockCopy={null}
            onRate={handleRate}
          />
        </div>
      </div>

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
        onClose={() => setShowInviteModal(false)}
        onShare={() => handleShare('invite_modal')}
      />

      <Toast message={toast.message} isVisible={toast.isVisible} onClose={toast.hide} />
    </AppShell>
  );
}
