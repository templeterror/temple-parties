'use client';

/**
 * HeadlinerCard — the marquee treatment for the weekend's #1 party (WF-B2).
 *
 * The most popular party of the night gets a stage: the full-width cinema
 * poster (StagePoster blur-fill), the yellow HYPED badge, a big uppercase
 * title, and a full-width GOING bar. Everything below it in the feed is a
 * compact PartyCard — the size gap IS the hierarchy.
 *
 * Like PartyCard, the ENTIRE card is one tap target for the detail page
 * (stretched Link, z-1); only the GOING/navigate row floats above it (z-2).
 * The vote row is read-only here — rating happens on the detail page.
 *
 * Takes the exact same FeedCardProps as PartyCard, so the page builds one
 * props object per party and just picks which card to mount.
 */

import Link from 'next/link';
import { memo, useCallback } from 'react';
import GoingButton from './GoingButton';
import type { FeedCardProps } from './PartyCard';
import { ratingWindowState } from './PartyCard';
import StagePoster from '@/components/ui/StagePoster';
import Pill from '@/components/ui/Pill';
import IconButton from '@/components/ui/IconButton';
import NavigateIcon from '@/components/ui/NavigateIcon';
import VerifiedMark from '@/components/ui/VerifiedMark';
import VoteRow from '@/components/ui/VoteRow';
import AddressGate from '@/components/ui/AddressGate';
import LastSemesterChampBadge from './LastSemesterChampBadge';
import { isLastSemesterChampion } from '@/lib/lastSemesterChampions';
import { voteCounts } from '@/utils/ratingHelpers';
import { displayDoorTime } from '@/utils/dateHelpers';
import { openMapsDirections } from '../utils/shareHelpers';
import { usePartyHref } from '@/contexts/DemoModeContext';

function HeadlinerCard({
  id,
  title,
  host,
  category,
  doorsOpen,
  address,
  goingCount,
  isHyped,
  userIsGoing,
  onGoingClick,
  onNavigateClick,
  onViewAddressClick,
  likePercentage,
  ratingCount,
  userRating,
  isRatingActive,
  isRatingLocked,
  isVerified,
  posterImage,
  onShowToast,
}: FeedCardProps) {
  const detailHref = usePartyHref(id);
  const handleNavigate = () => {
    if (onNavigateClick) {
      void onNavigateClick(id);
    }
    if (address) {
      openMapsDirections(address);
    }
  };

  const handleGoing = useCallback(() => onGoingClick(id), [onGoingClick, id]);
  const handleViewAddress = useCallback(() => onViewAddressClick(id), [onViewAddressClick, id]);

  const votes = voteCounts(likePercentage, ratingCount);

  return (
    <article className="relative w-full mb-3 bg-temple-surface-2 border border-white/10 rounded-2xl overflow-hidden animate-slide-up-fade">
      {/* The whole-card tap target — everything except the action row
          falls through to this link. */}
      <Link href={detailHref} className="absolute inset-0 z-[1]" aria-label={`View ${title}`}>
        <span className="sr-only">View party</span>
      </Link>

      <StagePoster src={posterImage} title={title} priority />

      <div className="flex flex-col gap-2 px-3.5 pt-3 pb-3.5">
        {/* Badges left, chevron signpost right — one quiet row. */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {isHyped && (
              <Pill tone="hyped" size="sm" shape="square" title="Tonight's most popular party">
                HEADLINER
              </Pill>
            )}
            <Pill tone="accent" size="sm" shape="square">{category}</Pill>
          </div>
          <span className="text-temple-muted" aria-hidden>
            <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4">
              <path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </div>

        <h2 className="font-montserrat font-bold text-2xl leading-7 text-white uppercase">
          {title}
        </h2>

        {/* Host line: name, then the verified seal and the #1 crown as a
            matched 15px pair. The row's gap-1 is the only spacing — the
            marks carry no margins of their own. */}
        <div className="flex items-center gap-1 min-w-0 text-[15px] text-temple-purple-light">
          <p className="font-montserrat font-medium whitespace-nowrap overflow-hidden text-ellipsis">
            by {host}
          </p>
          {isVerified && <VerifiedMark onShowToast={onShowToast} />}
          {/* Static on the feed: the card is one tap target, so the crown
              just shows — tap-to-explain lives on the party page. */}
          {isLastSemesterChampion(host) && <LastSemesterChampBadge />}
        </div>

        <div className="flex items-center justify-between gap-2 font-montserrat text-[12px]">
          <p className="text-temple-muted min-w-0 truncate">
            {displayDoorTime(doorsOpen)}
            {' · '}
            <AddressGate
              address={address}
              onViewAddress={handleViewAddress}
            />
          </p>
          {/* Read-only — rating happens on the detail page. */}
          <VoteRow
            likeCount={votes?.likeCount ?? null}
            dislikeCount={votes?.dislikeCount ?? null}
            userRating={userRating}
            state={ratingWindowState(isRatingActive, isRatingLocked)}
            size="md"
          />
        </div>

        {/* Action row — floats above the card link. */}
        <div className="relative z-[2] flex gap-2.5 items-center">
          <GoingButton
            currentCount={goingCount}
            userIsGoing={userIsGoing}
            onGoingClick={handleGoing}
            variant="bar"
          />
          <IconButton
            label="Navigate"
            title="Opens walking directions"
            onClick={handleNavigate}
            tone="accent"
            size="md"
          >
            <NavigateIcon />
          </IconButton>
        </div>
      </div>
    </article>
  );
}

export default memo(HeadlinerCard);
