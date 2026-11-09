'use client';

/**
 * DeckCard — one party, one screen (DESIGN.md "Card anatomy (the feed)").
 *
 * Top: the whole flyer (`object-contain`, never cropped) on static blurred
 * wings of itself. Bottom: a fixed info panel on a black scrim — rank chip,
 * title, host line, facts, going count, controls. The panel keeps the same
 * height card to card so the flyer box doesn't jump as you swipe.
 *
 * Opening the party is a real link (flyer + Details) to /party/<id> or the
 * demo twin. Directions behave exactly like the old PartyCard: the page
 * callback always runs (auth gate + auto-RSVP), and maps only open when the
 * address is known (logged out it's soft-gated to null).
 */

import Image from 'next/image';
import Link from 'next/link';
import { memo } from 'react';
import NavigateIcon from '@/components/ui/NavigateIcon';
import VerifiedMark from '@/components/ui/VerifiedMark';
import LastSemesterChampBadge from '@/components/LastSemesterChampBadge';
import { openMapsDirections } from '@/utils/shareHelpers';
import { formatGoing, meaningfulCategory, type DeckRow } from '@/utils/partyDeck';
import { DECK_FOCUS_RING } from './RankStrip';

export interface DeckCardProps {
  row: DeckRow;
  /** "tonight" or the day name ("Friday"). */
  nightWord: string;
  /** #1 chip: hyped yellow + the app's one glow (upcoming/live night) or muted (past night). */
  topHyped: boolean;
  compact: boolean;
  href: string;
  /** Preload: the first card and the next one. */
  priority: boolean;
  /** Within one slide of the current: load now rather than lazily. */
  near: boolean;
  /** Render the blurred wings (bounded to slides near the current one). */
  showWings: boolean;
  loggedOut: boolean;
  onGoingClick: (partyId: string) => void;
  onNavigateClick: (partyId: string) => void | Promise<void>;
  /** Logged-out carrot on past cards ("Log in to see ratings"). */
  onViewAddress?: (partyId: string) => void;
}

function DeckCard({
  row,
  nightWord,
  topHyped,
  compact,
  href,
  priority,
  near,
  showWings,
  loggedOut,
  onGoingClick,
  onNavigateClick,
  onViewAddress,
}: DeckCardProps) {
  const { party } = row;
  const poster = party.posterImage;
  const past = row.phase === 'past';
  const ramp = compact ? 20 : 28;

  const handleNavigate = () => {
    void onNavigateClick(party.id);
    if (party.address) openMapsDirections(party.address);
  };

  return (
    <article
      // overflow-clip, not -hidden: the wings' scale-125 adds scrollable
      // overflow, and a hidden box can still be scrolled (focus, find-in-page),
      // which would slide the whole card up. clip can't scroll at all.
      className={`relative flex h-full flex-col overflow-clip rounded-[20px] ${poster ? 'bg-black' : 'bg-temple-surface'}`}
    >
      {/* Wings: the same flyer at a tiny rendition, blown up + blurred once
          (a static filter, never backdrop-filter — DESIGN.md rule 3). */}
      {poster && showWings && (
        <Image
          src={poster}
          alt=""
          aria-hidden
          fill
          sizes="96px"
          loading={near ? 'eager' : 'lazy'}
          className="pointer-events-none scale-125 object-cover opacity-60 blur-[20px]"
        />
      )}

      {/* The flyer, whole. Tapping it opens the party; Details is the
          keyboard/screen-reader route, so this link stays out of the tab
          order and the a11y tree. */}
      <Link href={href} tabIndex={-1} aria-hidden className="relative z-[1] block min-h-0 flex-1">
        {poster ? (
          // The flyer stops where the scrim turns dark, so no flyer text
          // sits under it; only the decorative wings run behind the ramp.
          <span className={`absolute inset-x-3 block ${compact ? 'top-2' : 'top-3'}`} style={{ bottom: ramp - 10 }}>
            <Image
              src={poster}
              alt=""
              fill
              sizes="(max-width: 640px) calc(100vw - 56px), 420px"
              className="object-contain"
              priority={priority}
              loading={priority ? undefined : near ? 'eager' : 'lazy'}
            />
          </span>
        ) : (
          // No flyer: a typographic tile — the title as texture, not a fake poster.
          <span
            className="absolute inset-0 flex items-center px-5 pb-6 text-left font-bold uppercase leading-[0.95] text-temple-purple-light/20"
            style={{ fontSize: tileFontSize(party.title, compact) }}
          >
            {party.title}
          </span>
        )}
      </Link>

      {/* Info panel. The scrim ramp is the panel's own top padding. */}
      <div
        className="party-deck__scrim relative z-[2] shrink-0 px-4"
        style={{
          ['--party-deck-ramp' as string]: `${ramp}px`,
          marginTop: -ramp,
          paddingTop: ramp,
          paddingBottom: compact ? 12 : 16,
        }}
      >
        {/* Eyebrow + title share a 2-line-title-tall block, bottom-aligned,
            so a 1-line title doesn't change the panel height. */}
        <div className="flex flex-col justify-end" style={{ minHeight: compact ? 20 + 4 + 44 : 24 + 6 + 52 }}>
          <div className={`flex items-center justify-between gap-3 ${compact ? 'mb-1' : 'mb-1.5'}`}>
            <CardLabels row={row} nightWord={nightWord} hyped={topHyped} past={past} />
            <GoingCount count={row.goingCount} past={past} />
          </div>
          <h2
            title={party.title}
            className={`line-clamp-2 text-balance font-bold ${
              compact ? 'text-[18px] leading-[22px]' : 'text-[22px] leading-[26px]'
            }`}
          >
            {party.title}
          </h2>
        </div>

        <HostLine row={row} compact={compact} />
        <Facts row={row} compact={compact} />

        <div className={`flex items-center gap-2 ${compact ? 'mt-2.5' : 'mt-3'}`}>
          {past ? (
            <PastSummary row={row} loggedOut={loggedOut} onViewAddress={onViewAddress} />
          ) : (
            <>
              <button
                type="button"
                onClick={() => onGoingClick(party.id)}
                aria-pressed={row.isGoing}
                className={`party-deck__press h-11 min-w-0 flex-1 rounded-full text-[14px] font-bold transition-colors duration-150 motion-reduce:transition-none ${
                  row.isGoing ? 'bg-temple-purple-light text-black' : 'bg-temple-purple text-white'
                } ${DECK_FOCUS_RING}`}
              >
                {row.isGoing ? 'Going ✓' : 'I’m going'}
              </button>
              <button
                type="button"
                onClick={handleNavigate}
                aria-label={`Directions to ${party.title}`}
                title="Opens walking directions"
                className={`party-deck__press flex size-11 shrink-0 items-center justify-center rounded-full text-temple-purple-light ring-1 ring-inset ring-white/15 ${DECK_FOCUS_RING}`}
              >
                <NavigateIcon className="size-4" />
              </button>
            </>
          )}
          <DetailsLink href={href} title={party.title} />
        </div>
      </div>

      {/* Hairline edge, above everything, so the card reads as one object. */}
      <span aria-hidden className="pointer-events-none absolute inset-0 z-[3] rounded-[20px] ring-1 ring-inset ring-white/10" />
    </article>
  );
}

// memo: the feed re-renders on realtime count ticks; cards whose row didn't
// change skip their render.
export default memo(DeckCard);

/**
 * No-flyer tile type size: as big as the longest word allows on one line
 * (~0.75em per bold uppercase Montserrat glyph in a ~290px column), so a
 * word never breaks mid-way.
 */
function tileFontSize(title: string, compact: boolean): number {
  const longest = Math.max(...title.split(/\s+/).map((w) => w.length), 1);
  return Math.round(Math.min(compact ? 40 : 48, 290 / (longest * 0.75)));
}

/** 12px tracked caps — one step up from a chip, since there's no box to carry it. */
const EYEBROW = 'text-[12px] uppercase leading-4 tracking-[0.08em]';

/**
 * Card labels — "Quiet" (owner, 2026-11-08, from /proto/chips): no fills or
 * boxes. The category is a muted caps eyebrow; the top party gets yellow
 * "#1 tonight" text (a text colour only — no box, no glow) joined by a middle
 * dot. "Other" shows no label. Past nights mute both.
 */
function CardLabels({ row, nightWord, hyped, past }: { row: DeckRow; nightWord: string; hyped: boolean; past: boolean }) {
  const category = meaningfulCategory(row.party.category);
  return (
    <div className={`flex min-w-0 items-center gap-1.5 ${EYEBROW}`}>
      {row.isTop && (
        <span className={`shrink-0 font-bold ${hyped ? 'text-temple-hyped' : 'text-white/60'}`}>#1 {nightWord}</span>
      )}
      {row.isTop && category && (
        <span aria-hidden className="shrink-0 text-white/40">
          ·
        </span>
      )}
      {category && (
        <span className={`min-w-0 truncate font-semibold ${past ? 'text-white/50' : 'text-temple-muted'}`}>{category}</span>
      )}
    </div>
  );
}

function GoingCount({ count, past }: { count: number | null; past: boolean }) {
  return (
    <span className="shrink-0 text-[13px] leading-5 tabular-nums">
      <span className={`font-bold ${count === null ? 'text-temple-muted' : 'text-white'}`}>{formatGoing(count)}</span>
      <span className="text-white/70"> {past ? 'went' : 'going'}</span>
    </span>
  );
}

function HostLine({ row, compact }: { row: DeckRow; compact: boolean }) {
  const { party } = row;
  return (
    <div
      className={`flex min-w-0 items-center gap-1 text-temple-purple-light ${
        compact ? 'mt-1 text-[13px] leading-[18px]' : 'mt-1.5 text-[14px] leading-5'
      }`}
    >
      <span title={party.host} className="min-w-0 truncate font-medium">
        by {party.host}
      </span>
      {party.isVerified && <VerifiedMark />}
      {row.isChampion && <LastSemesterChampBadge />}
      {row.hostLikePct !== null && (
        <span className="shrink-0 whitespace-nowrap pl-1 text-white/70 tabular-nums">· {row.hostLikePct}% liked</span>
      )}
    </div>
  );
}

function Facts({ row, compact }: { row: DeckRow; compact: boolean }) {
  const when =
    row.phase === 'live' ? (
      <span className="flex shrink-0 items-center gap-1.5 font-semibold text-white">
        <span aria-hidden className="size-1.5 rounded-full bg-temple-purple-light" />
        Live now
      </span>
    ) : row.phase === 'past' ? (
      <span className="shrink-0 font-semibold text-white/70">Ended</span>
    ) : (
      <span className="shrink-0 font-semibold text-white">Doors {row.doorsLabel}</span>
    );

  // Short prices ("Free", "$5") ride inline. Host free text ("$15 presale /
  // $20 door") gets its own line, whole, rather than an ellipsis.
  const longPrice = row.priceLabel.length > 10;
  const size = compact ? 'text-[12px] leading-4' : 'text-[13px] leading-[18px]';

  return (
    <div className={`text-white/70 tabular-nums ${size} ${compact ? 'mt-0.5' : 'mt-1'}`}>
      <div className="flex min-w-0 items-center gap-1.5">
        {when}
        {!longPrice && (
          <>
            <span aria-hidden>·</span>
            <span className="shrink-0 whitespace-nowrap">{row.priceLabel}</span>
          </>
        )}
        {row.walkMinutes !== null && (
          <>
            <span aria-hidden>·</span>
            <span className="min-w-0 truncate" title="Walking time from the Bell Tower">
              {row.walkMinutes} min walk
            </span>
          </>
        )}
      </div>
      {longPrice && (
        <p title={row.priceLabel} className="mt-0.5 truncate">
          <span className="text-white/50">Cover </span>
          <span className="text-white">{row.priceLabel}</span>
        </p>
      )}
    </div>
  );
}

function PastSummary({
  row,
  loggedOut,
  onViewAddress,
}: {
  row: DeckRow;
  loggedOut: boolean;
  onViewAddress?: (partyId: string) => void;
}) {
  const total = row.votes ? row.votes.like + row.votes.dislike : 0;
  const pct = row.votes && total > 0 ? Math.round((row.votes.like / total) * 100) : null;

  if (pct === null && loggedOut && onViewAddress) {
    return (
      <button
        type="button"
        onClick={() => onViewAddress(row.party.id)}
        className={`h-11 min-w-0 flex-1 truncate rounded-full text-left text-[13px] leading-5 text-white/70 underline underline-offset-2 ${DECK_FOCUS_RING}`}
      >
        Log in to see ratings
      </button>
    );
  }

  return (
    <p className="min-w-0 flex-1 truncate text-[13px] leading-5 text-white/70 tabular-nums">
      {pct !== null ? (
        <>
          <span className="font-bold text-white">{pct}% liked it</span> · {total} {total === 1 ? 'vote' : 'votes'}
        </>
      ) : loggedOut ? (
        'Log in to see ratings'
      ) : (
        'No ratings yet'
      )}
    </p>
  );
}

function DetailsLink({ href, title }: { href: string; title: string }) {
  return (
    <Link
      href={href}
      aria-label={`Details: ${title}`}
      className={`party-deck__press flex h-11 shrink-0 items-center gap-1 rounded-full pl-4 pr-3 text-[14px] font-semibold text-white ring-1 ring-inset ring-white/15 ${DECK_FOCUS_RING}`}
    >
      Details
      <svg viewBox="0 0 24 24" fill="none" className="size-4 text-white/70" aria-hidden>
        <path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </Link>
  );
}
