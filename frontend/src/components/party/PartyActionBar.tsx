/**
 * PartyActionBar — the DeckCard's controls, pinned in the kit's
 * StickyActionBar (solid `temple-surface`, safe-area padded, z-9000):
 *
 *   [ I'm going / Going ✓  — or —  Buy tickets ↗ ]  (directions)  (share)
 *
 * Exactly one filled primary. Ticketed parties put `Buy tickets ↗` in that
 * seat (GOING for those lives on the feed card, and buying auto-RSVPs);
 * everyone else gets the going toggle. Directions and share are 44px
 * outlined discs. Once the party is over AND voting has closed
 * (`model.shareOnly`) there's nothing left to do but tell people, so the
 * bar is Share alone. While votes are still open after doors close the
 * going toggle stays — rating is going-only, and the toast that says so
 * points at it.
 *
 * Callbacks only — every rule (auth gate, auto-RSVP, maps, analytics)
 * belongs to the page.
 */

import NavigateIcon from '@/components/ui/NavigateIcon';
import ShareIcon from '@/components/ui/ShareIcon';
import StickyActionBar from '@/components/ui/StickyActionBar';
import { DECK_FOCUS_RING } from '@/components/feed/RankStrip';
import type { PartyPageModel } from '@/utils/partyPage';
import { PARTY_GHOST } from './PartyFactsList';

interface PartyActionBarProps {
  model: PartyPageModel;
  isGoing: boolean;
  onGoing: () => void;
  onNavigate: () => void;
  onBuyTickets: () => void;
  onShare: () => void;
}

export default function PartyActionBar({ model, isGoing, onGoing, onNavigate, onBuyTickets, onShare }: PartyActionBarProps) {
  if (model.shareOnly) {
    return (
      <StickyActionBar>
        <button
          type="button"
          onClick={onShare}
          className={`${PARTY_GHOST} flex h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-full text-[14px] font-semibold text-white`}
        >
          <ShareIcon className="size-4 text-temple-purple-light" />
          Share
        </button>
      </StickyActionBar>
    );
  }

  const primary = `party-page__primary party-page__press h-11 min-w-0 flex-1 rounded-full text-[14px] font-bold ${DECK_FOCUS_RING}`;

  return (
    <StickyActionBar>
      {model.ticketUrl ? (
        <a
          href={model.ticketUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onBuyTickets}
          className={`${primary} flex items-center justify-center bg-temple-purple text-white`}
        >
          Buy tickets <span aria-hidden>&nbsp;↗</span>
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      ) : (
        <button
          type="button"
          onClick={onGoing}
          aria-pressed={isGoing}
          className={`${primary} ${isGoing ? 'bg-temple-purple-light text-black' : 'bg-temple-purple text-white'}`}
        >
          {isGoing ? 'Going ✓' : 'I’m going'}
        </button>
      )}
      <button
        type="button"
        onClick={onNavigate}
        aria-label="Directions"
        title="Opens walking directions"
        className={`${PARTY_GHOST} flex size-11 shrink-0 items-center justify-center rounded-full text-temple-purple-light`}
      >
        <NavigateIcon className="size-4" />
      </button>
      <button
        type="button"
        onClick={onShare}
        aria-label="Share"
        className={`${PARTY_GHOST} flex size-11 shrink-0 items-center justify-center rounded-full text-temple-purple-light`}
      >
        <ShareIcon className="size-[18px]" />
      </button>
    </StickyActionBar>
  );
}
