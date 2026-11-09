/**
 * VoteRow — the compact like/dislike readout (reddit arrows + counts).
 *
 * Display rules:
 *  - Soft-gated viewers (logged out) get null counts from the server →
 *    we show dashes instead of fake zeros.
 *  - Your own vote fills its ARROW with the secondary light purple — the
 *    fill lives on the icon itself, no chip around it.
 *
 * Interaction: pass `onRate` and the row becomes one tappable unit (a div
 * with role="button", never a nested <button> — the old §8.9 bug). Omit
 * `onRate` and it's a pure readout: on feed cards taps fall through to the
 * card's own link, which opens the detail page where real rating lives.
 *
 * `state` tells the row where the rating window is:
 *  inactive = doors haven't opened · open = rate away · locked = window over.
 */

import type { KeyboardEvent } from 'react';
import VoteArrow from './VoteArrow';

export type RatingWindowState = 'inactive' | 'open' | 'locked';

/** Maps the party's two server booleans onto the one window state the row speaks. */
export function ratingWindowState(isRatingActive: boolean, isRatingLocked: boolean): RatingWindowState {
  if (isRatingLocked) return 'locked';
  return isRatingActive ? 'open' : 'inactive';
}

interface VoteRowProps {
  likeCount: number | null;
  dislikeCount: number | null;
  /** 1 = you thumbed up, 0 = down, null = you haven't rated. */
  userRating: number | null;
  onRate?: () => void;
  state: RatingWindowState;
  size?: 'sm' | 'md';
}

const STATE_TITLES: Record<RatingWindowState, string | undefined> = {
  inactive: 'Ratings unlock when doors open',
  locked: 'Ratings are closed',
  open: undefined,
};

export default function VoteRow({
  likeCount,
  dislikeCount,
  userRating,
  onRate,
  state,
  size = 'sm',
}: VoteRowProps) {
  const text = size === 'md' ? 'text-[14px]' : 'text-[13px]';
  const icon = size === 'md' ? 'w-[17px] h-[17px]' : 'w-[15px] h-[15px]';

  // Interactive only when a handler is supplied. Taps always reach it —
  // even when the window is closed — because on mobile a toast is the only
  // way to explain a locked control. The handler owns that messaging.
  const interactiveProps = onRate
    ? {
        role: 'button' as const,
        tabIndex: 0,
        onClick: () => onRate(),
        onKeyDown: (e: KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onRate();
          }
        },
      }
    : {};

  return (
    <div
      {...interactiveProps}
      title={STATE_TITLES[state]}
      className={`flex items-center gap-3 shrink-0 tabular-nums ${state === 'open' && onRate ? 'cursor-pointer' : ''}`}
    >
      {/* The fill lives on the ARROW only — your vote's icon goes solid
          light purple, nothing wraps around it. */}
      <span className={`flex items-center gap-1 ${text} font-montserrat font-bold whitespace-nowrap ${userRating === 1 ? 'text-temple-purple-light' : 'text-white'}`}>
        <VoteArrow direction="up" filled={userRating === 1} className={icon} />
        {likeCount ?? '–'}
      </span>
      <span className={`flex items-center gap-1 ${text} font-montserrat font-medium whitespace-nowrap ${userRating === 0 ? 'text-temple-purple-light' : 'text-temple-muted'}`}>
        <VoteArrow direction="down" filled={userRating === 0} className={icon} />
        {dislikeCount ?? '–'}
      </span>
    </div>
  );
}
