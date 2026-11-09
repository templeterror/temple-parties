/**
 * RatingPanel — the "WAS IT GOOD?" module on the party page: a like-ratio
 * bar, the up/down counts, and inline thumb buttons that submit a rating
 * directly (no modal — the party page IS the context).
 *
 * The panel is deliberately dumb: the page decides whether tapping a thumb
 * signs you in, submits, or bounces off the server's rules. What the panel
 * owns is honest presentation:
 *  - Ratings are account-keyed and RSVP-gated server-side, and only open in
 *    a window around doors — `state` + `lockCopy` surface that ("Unlocks at
 *    11 PM · Going only") instead of leaving dead buttons unexplained.
 *  - Soft-gated viewers (logged out) get null counts → the bar renders
 *    empty and the numbers show dashes, never fake zeros.
 */

import SectionLabel from '@/components/ui/SectionLabel';
import VoteArrow from '@/components/ui/VoteArrow';
import type { RatingWindowState } from '@/components/ui/VoteRow';

interface RatingPanelProps {
  likePercentage: number | null;
  likeCount: number | null;
  dislikeCount: number | null;
  /** 1 = you thumbed up, 0 = down, null = not rated yet. */
  userRating: number | null;
  state: RatingWindowState;
  /** The line explaining why the thumbs are locked (or how to unlock them). */
  lockCopy?: string | null;
  onRate: (rating: 1 | 0) => void;
}

export default function RatingPanel({
  likePercentage,
  likeCount,
  dislikeCount,
  userRating,
  state,
  lockCopy,
  onRate,
}: RatingPanelProps) {
  const open = state === 'open';
  const hasCounts = likeCount !== null && dislikeCount !== null && likePercentage !== null;
  const total = hasCounts ? likeCount + dislikeCount : 0;
  // Bar width follows the like percentage; with zero ratings there is nothing
  // to divide, so the bar stays all-neutral instead of implying 0% liked it.
  const likeWidth = hasCounts && total > 0 ? Math.max(2, Math.min(98, likePercentage)) : 0;

  // Your own vote fills with the secondary (light purple) — same accent as
  // the navigate button — so "selected" reads instantly against the outline.
  const thumbClass = (active: boolean) =>
    `w-[52px] h-11 flex items-center justify-center rounded-[10px] font-montserrat font-bold text-[18px] transition-all duration-150 ${
      active
        ? 'bg-temple-purple-light text-temple-purple'
        : 'border border-white/15 text-white'
    } ${open ? 'hover:border-temple-purple-light active:scale-[0.97]' : 'opacity-40 cursor-default'}`;

  return (
    <div className="w-full flex flex-col gap-2.5 bg-temple-surface rounded-[14px] px-3.5 pt-3 pb-3.5">
      <SectionLabel className="!text-[10px] !tracking-[1px]">WAS IT GOOD?</SectionLabel>

      {/* Ratio bar: purple = thumbs up share, grey = the rest. */}
      <div className="flex gap-[2px] w-full h-2">
        {likeWidth > 0 ? (
          <>
            <div className="h-2 rounded-[4px] bg-temple-purple" style={{ width: `${likeWidth}%` }} />
            <div className="h-2 rounded-[4px] bg-[#3a3a3a] flex-1" />
          </>
        ) : (
          <div className="h-2 rounded-[4px] bg-[#3a3a3a] w-full" />
        )}
      </div>

      <div className="flex items-center justify-between text-[12px] font-montserrat">
        <p className="flex items-center gap-1 font-bold text-white">
          <VoteArrow direction="up" className="w-[14px] h-[14px]" />
          {likeCount ?? '–'}
        </p>
        <p className="flex items-center gap-1 font-medium text-temple-muted">
          <VoteArrow direction="down" className="w-[14px] h-[14px]" />
          {dislikeCount ?? '–'}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => open && onRate(1)}
          disabled={!open}
          aria-label="Vote up"
          className={thumbClass(userRating === 1)}
        >
          <VoteArrow direction="up" filled={userRating === 1} className="w-[18px] h-[18px]" />
        </button>
        <button
          type="button"
          onClick={() => open && onRate(0)}
          disabled={!open}
          aria-label="Vote down"
          className={thumbClass(userRating === 0)}
        >
          <VoteArrow direction="down" filled={userRating === 0} className="w-[18px] h-[18px]" />
        </button>
        {lockCopy && (
          <p className="font-montserrat text-[10.5px] text-temple-muted">{lockCopy}</p>
        )}
      </div>
    </div>
  );
}
