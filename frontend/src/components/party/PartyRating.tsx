/**
 * PartyRating — "Was it good?", shown only when it matters (mode from
 * utils/partyPage.ts `ratingMode`, which follows the server's window):
 *
 *  - `before` (doors not open): no panel, one quiet line.
 *  - `open` (doors → Monday 11:59 PM lock): the result so far
 *    (`90% liked · 64 votes`) + 48px up / down buttons. Your own vote fills.
 *  - `closed`: the result + `Voting closed`, no buttons.
 *
 * Dumb on purpose: the page decides whether a tap signs you in, submits, or
 * bounces off a rule (going-only is enforced server-side and surfaced as a
 * toast on attempt — never preached here). Soft-gated viewers have no
 * result line, so the buttons sit under the label instead of floating
 * right of nothing.
 */

import VoteArrow from '@/components/ui/VoteArrow';
import type { PartyPageModel } from '@/utils/partyPage';
import { PARTY_QUIET } from './PartyFactsList';

interface PartyRatingProps {
  model: PartyPageModel;
  /** 1 = you voted up, 0 = down, null = not yet. */
  userRating: number | null;
  onRate: (rating: 1 | 0) => void;
}

export default function PartyRating({ model, userRating, onRate }: PartyRatingProps) {
  const { ratingMode: mode, voteResult: result } = model;

  if (mode === 'before') {
    return <p className="mt-8 text-[13px] leading-[18px] text-temple-muted">Voting opens when doors open</p>;
  }

  const closed = mode === 'closed';
  const hasSummary = !!result || closed;

  return (
    <section aria-labelledby="party-page-rating" className="mt-8">
      <h2 id="party-page-rating" className={PARTY_QUIET}>
        Was it good?
      </h2>
      <div className={`mt-2 flex min-h-12 items-center gap-3 ${hasSummary ? 'justify-between' : ''}`}>
        {hasSummary && (
          <div className="min-w-0">
            {result && <p className="text-[15px] font-semibold leading-5 text-white tabular-nums">{result}</p>}
            {closed && <p className="mt-0.5 text-[13px] leading-[18px] text-temple-muted">Voting closed</p>}
          </div>
        )}
        {!closed && (
          <div className="flex shrink-0 gap-2">
            <VoteButton dir="up" active={userRating === 1} onClick={() => onRate(1)} />
            <VoteButton dir="down" active={userRating === 0} onClick={() => onRate(0)} />
          </div>
        )}
      </div>
    </section>
  );
}

function VoteButton({ dir, active, onClick }: { dir: 'up' | 'down'; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={dir === 'up' ? 'Vote up' : 'Vote down'}
      aria-pressed={active}
      className={`party-page__ghost party-page__press flex size-12 items-center justify-center rounded-full ring-1 ring-inset focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
        active ? 'text-temple-purple-light ring-temple-purple-light' : 'text-white ring-white/15'
      }`}
    >
      <VoteArrow direction={dir} filled={active} className="size-5" />
    </button>
  );
}
