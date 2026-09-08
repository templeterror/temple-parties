'use client';

/**
 * PartyCard — the compact feed card, on the classic v1 layout the app
 * launched with (owner call): big poster pane on the left (~42% of the
 * card), and the info column on the right — category tag, title, host,
 * door time, the like/dislike counts, and a full-width GOING bar with the
 * navigate button.
 *
 * The ENTIRE card is one tap target for the detail page: a stretched
 * invisible Link covers it, and only the GOING/navigate action row floats
 * above that link (z-index) as in-card actions. Everything else — poster,
 * title, votes, chevron — falls through to the link. Rating on a feed card
 * intentionally routes to the detail page too; that's where real rating
 * lives (with its window and RSVP rules explained).
 *
 * The weekend's #1 party doesn't use this card at all — it gets the big
 * HeadlinerCard. Both share the exact same props (FeedCardProps), so pages
 * build ONE props object per party and simply choose which card to mount.
 */

import Image from 'next/image';
import Link from 'next/link';
import { memo, useCallback } from 'react';
import GoingButton from './GoingButton';
import IconButton from '@/components/ui/IconButton';
import NavigateIcon from '@/components/ui/NavigateIcon';
import Pill from '@/components/ui/Pill';
import VerifiedMark from '@/components/ui/VerifiedMark';
import VoteRow, { type RatingWindowState } from '@/components/ui/VoteRow';
import LastSemesterChampBadge from './LastSemesterChampBadge';
import { isLastSemesterChampion } from '@/lib/lastSemesterChampions';
import { voteCounts } from '@/utils/ratingHelpers';
import { displayDoorTime } from '@/utils/dateHelpers';
import { openMapsDirections } from '../utils/shareHelpers';
import { usePartyHref } from '@/contexts/DemoModeContext';

/**
 * The shared data contract for both feed cards (compact + headliner).
 * Pages build this once per party — see feedCardProps() in app/page.tsx.
 */
export interface FeedCardProps {
  id: string;
  title: string;
  host: string;
  category: string;
  doorsOpen: string;
  /** null = server soft-gated it (viewer is logged out). */
  address: string | null;
  goingCount: number | null;
  /** Is this the weekend's top party? Only the headliner renders the badge. */
  isHyped: boolean;
  userIsGoing: boolean;
  onGoingClick: (partyId: string) => void;
  onNavigateClick?: (partyId: string) => void | Promise<void>;
  isAddressVisible: boolean;
  onViewAddressClick: (partyId: string) => void;
  /** Overlay-adjusted rating numbers (they move instantly when you rate). */
  likePercentage: number | null;
  ratingCount: number | null;
  userRating: number | null;
  onRateClick: (
    partyId: string,
    title: string,
    host: string,
    isRatingActive: boolean,
    isRatingLocked: boolean,
  ) => void;
  isRatingActive: boolean;
  isRatingLocked: boolean;
  isVerified: boolean;
  posterImage?: string;
  onShowToast?: (message: string) => void;
}

/** Maps the two server booleans onto the one window state the kit speaks. */
export function ratingWindowState(isRatingActive: boolean, isRatingLocked: boolean): RatingWindowState {
  if (isRatingLocked) return 'locked';
  return isRatingActive ? 'open' : 'inactive';
}

function PartyCard({
  id,
  title,
  host,
  category,
  doorsOpen,
  address,
  goingCount,
  userIsGoing,
  onGoingClick,
  onNavigateClick,
  userRating,
  likePercentage,
  ratingCount,
  isRatingActive,
  isRatingLocked,
  isVerified,
  posterImage,
  onShowToast,
}: FeedCardProps) {
  const detailHref = usePartyHref(id);
  // Navigate always fires the page callback (which handles the login gate
  // and auto-RSVP); directions only open when we actually have an address.
  const handleNavigate = () => {
    if (onNavigateClick) {
      void onNavigateClick(id);
    }
    if (address) {
      openMapsDirections(address);
    }
  };

  const handleGoing = useCallback(() => onGoingClick(id), [onGoingClick, id]);

  const votes = voteCounts(likePercentage, ratingCount);

  return (
    // No fixed height — the info column sizes the card, so there's never
    // dead space between the last line and the action row.
    <article className="relative flex w-full mb-3 bg-temple-surface-2 border border-white/10 rounded-[14px] overflow-hidden animate-slide-up-fade">
      {/* The whole-card tap target. Sits above all content (z-1); only the
          action row floats higher (z-2) to stay independently tappable. */}
      <Link href={detailHref} className="absolute inset-0 z-[1]" aria-label={`View ${title}`}>
        <span className="sr-only">View party</span>
      </Link>

      {/* Poster pane. */}
      <div className="relative w-[42%] shrink-0 overflow-hidden bg-temple-surface">
        {posterImage ? (
          <Image
            src={posterImage}
            alt={`${title} poster`}
            fill
            sizes="(max-width: 768px) 42vw, 240px"
            className="object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-temple-purple/40 to-[#171f4d] flex items-center justify-center px-2">
            <span className="text-white/25 font-montserrat font-bold text-[13px] text-center leading-tight">
              {title}
            </span>
          </div>
        )}
      </div>

      {/* Info column — short lines with room to breathe. */}
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="flex-1 flex flex-col gap-2.5 px-3 pt-3">
          <div className="flex items-center justify-between gap-2">
            <Pill tone="accent" size="sm" shape="square">{category}</Pill>
            {/* Decorative signpost — the tap itself lands on the card link. */}
            <span className="text-temple-muted" aria-hidden>
              <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4">
                <path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </div>

          <h2 className="font-montserrat font-bold text-[20px] leading-6 text-white truncate">
            {title}
          </h2>

          {/* Host line: name, then the verified seal and the #1 crown as a
              matched 15px pair. The row's gap-1 is the only spacing — the
              marks carry no margins of their own. */}
          <div className="flex items-center gap-1 min-w-0 text-[14px] text-temple-purple-light">
            <p className="font-montserrat whitespace-nowrap overflow-hidden text-ellipsis">
              by {host}
            </p>
            {isVerified && <VerifiedMark onShowToast={onShowToast} />}
            {/* Static on the feed: the card is one tap target, so the crown
                just shows — tap-to-explain lives on the party page. */}
            {isLastSemesterChampion(host) && <LastSemesterChampBadge />}
          </div>

          {/* Door time + votes share one row, sitting together on the left.
              The votes are read-only here — tapping them (like anywhere
              else) opens the detail page. */}
          <div className="flex items-center gap-3 mt-1">
            <p className="font-montserrat text-[14px] text-white/70 whitespace-nowrap">{displayDoorTime(doorsOpen)}</p>
            <VoteRow
              likeCount={votes?.likeCount ?? null}
              dislikeCount={votes?.dislikeCount ?? null}
              userRating={userRating}
              state={ratingWindowState(isRatingActive, isRatingLocked)}
              size="md"
            />
          </div>
        </div>

        {/* Action row — floats above the card link so GOING/navigate stay
            their own buttons. */}
        <div className="relative z-[2] flex items-center gap-2 px-3 pb-3 pt-2">
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

// memo: the feed re-renders on every realtime count tick; cards whose props
// didn't change skip their render entirely.
export default memo(PartyCard);
