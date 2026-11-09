'use client';

/**
 * RanksEmpty / RanksNothingRanked — what the Ranks page shows when a period
 * has nothing to celebrate.
 *
 * Both stand on `RanksGhostPodium` (three empty steps in the filled
 * podium's footprint), so switching to a period with data doesn't shift
 * the page (emil-ui-polish: empty states sized like the filled state).
 *
 * - `RanksEmpty`: the period has no rows at all. Headline + one line + a
 *   button to the next useful view ("See this semester", "See host ranks")
 *   — an empty state teaches and offers a next step, it isn't an error.
 * - `RanksNothingRanked`: rows exist but none clears the floor yet; the
 *   unranked group follows below it, so it's just a ghost podium + a line.
 */

import { DECK_FOCUS_RING } from '@/components/feed/RankStrip';
import { RanksGhostPodium } from './RanksPodium';

interface RanksEmptyProps {
  /** "No votes yet for last weekend." */
  title: string;
  /** "Voting opens when doors do." */
  description: string;
  /** Button label, e.g. "See this semester". */
  actionLabel: string;
  onAction: () => void;
}

export function RanksEmpty({ title, description, actionLabel, onAction }: RanksEmptyProps) {
  return (
    <section className="mt-4">
      <RanksGhostPodium />
      <div className="mt-6 text-center">
        <h2 className="text-balance text-[17px] font-bold leading-[22px]">{title}</h2>
        <p className="mt-1 text-[14px] leading-5 text-temple-muted">{description}</p>
        <button
          type="button"
          onClick={onAction}
          className={`ranks__press mt-5 inline-flex h-11 items-center rounded-full bg-temple-purple-light px-5 text-[15px] font-semibold text-black ${DECK_FOCUS_RING}`}
        >
          {actionLabel}
        </button>
      </div>
    </section>
  );
}

export function RanksNothingRanked({ children }: { children: string }) {
  return (
    <div className="mt-4">
      <RanksGhostPodium />
      <p className="mt-4 text-center text-[14px] leading-5 text-temple-muted">{children}</p>
    </div>
  );
}
