'use client';

/**
 * RankStrip — the row of flyer thumbs above the deck: 1…N in rank order,
 * the current one ringed, tap a thumb to jump to that party. It's the
 * night's ranking at a glance and shows how far through the night you are.
 *
 * Mirrors the deck slide for slide, so the sponsor slide appears here too —
 * as a narrow muted "Ad" marker between #1 and #2 (decorative; the ad is
 * reached by swiping). Party numbers never count the ad.
 */

import Image from 'next/image';
import type { DeckRow } from '@/utils/partyDeck';

export const DECK_FOCUS_RING =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white';

export type StripItem = { kind: 'party'; row: DeckRow } | { kind: 'sponsor' };

interface RankStripProps {
  items: StripItem[];
  /** Index into `items` (= the deck's slide index). */
  activeIndex: number;
  compact: boolean;
  /** #1's number chip goes yellow on upcoming/live nights, plain on past ones. */
  topHyped: boolean;
  onJump: (index: number) => void;
  stripRef: (el: HTMLDivElement | null) => void;
  itemRef: (index: number, el: HTMLElement | null) => void;
}

export default function RankStrip({
  items,
  activeIndex,
  compact,
  topHyped,
  onJump,
  stripRef,
  itemRef,
}: RankStripProps) {
  return (
    <div
      ref={stripRef}
      role="group"
      aria-label="Jump to a party"
      className={`party-deck__strip flex shrink-0 px-3 ${compact ? 'pb-1.5' : 'pb-2'}`}
    >
      {items.map((item, i) =>
        item.kind === 'sponsor' ? (
          <AdMarker
            key="sponsor"
            active={i === activeIndex}
            compact={compact}
            markerRef={(el) => itemRef(i, el)}
          />
        ) : (
          <RankThumb
            key={item.row.id}
            row={item.row}
            active={i === activeIndex}
            compact={compact}
            hyped={item.row.isTop && topHyped}
            onClick={() => onJump(i)}
            buttonRef={(el) => itemRef(i, el)}
          />
        ),
      )}
    </div>
  );
}

function RankThumb({
  row,
  active,
  compact,
  hyped,
  onClick,
  buttonRef,
}: {
  row: DeckRow;
  active: boolean;
  compact: boolean;
  hyped: boolean;
  onClick: () => void;
  buttonRef: (el: HTMLButtonElement | null) => void;
}) {
  const poster = row.party.posterImage;
  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={onClick}
      aria-label={`#${row.rank} ${row.party.title}`}
      aria-current={active ? 'true' : undefined}
      className={`party-deck__press flex w-11 shrink-0 items-center justify-center rounded-[10px] ${
        compact ? 'h-11' : 'h-12'
      } ${DECK_FOCUS_RING}`}
    >
      <span
        className={`relative block overflow-hidden rounded-[6px] bg-temple-surface-2 ${compact ? 'h-9 w-7' : 'h-10 w-8'} ${
          active ? 'ring-2 ring-white ring-offset-2 ring-offset-black' : 'ring-1 ring-inset ring-white/10'
        }`}
      >
        {poster ? (
          <Image
            src={poster}
            alt=""
            fill
            sizes="40px"
            // Always on screen and tiny: load now rather than lazily.
            loading="eager"
            className={`object-cover transition-opacity duration-150 motion-reduce:transition-none ${
              active ? 'opacity-100' : 'opacity-50'
            }`}
          />
        ) : (
          <span
            aria-hidden
            className={`absolute inset-0 flex items-center justify-center text-[13px] font-bold text-temple-purple-light ${
              active ? 'opacity-100' : 'opacity-50'
            }`}
          >
            {row.party.title.charAt(0)}
          </span>
        )}
        <span
          aria-hidden
          className={`absolute bottom-0 left-0 rounded-tr-[5px] px-[5px] py-px text-[10px] font-bold leading-[13px] tabular-nums ${
            hyped ? 'bg-temple-hyped text-temple-hyped-ink' : 'bg-black/80 text-white'
          }`}
        >
          {row.rank}
        </span>
      </span>
    </button>
  );
}

/** Narrow, muted, not a control: keeps the strip's order honest about the ad slide. */
function AdMarker({
  active,
  compact,
  markerRef,
}: {
  active: boolean;
  compact: boolean;
  markerRef: (el: HTMLSpanElement | null) => void;
}) {
  return (
    <span
      ref={markerRef}
      aria-hidden
      className={`flex w-7 shrink-0 items-center justify-center ${compact ? 'h-11' : 'h-12'}`}
    >
      <span
        className={`flex items-center justify-center rounded-[6px] text-[10px] font-bold leading-none ${
          compact ? 'h-9 w-5' : 'h-10 w-5'
        } ${
          active
            ? 'text-white ring-2 ring-white ring-offset-2 ring-offset-black'
            : 'text-temple-muted ring-1 ring-inset ring-white/10'
        }`}
      >
        Ad
      </span>
    </span>
  );
}
