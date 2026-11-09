'use client';

/**
 * PartyDeck — the home feed (DESIGN.md decision log, 2026-11-07 "Feed cards
 * → Deck"). One party per screen, swiped horizontally with native
 * scroll-snap, in going-count order (utils/partyDeck rankParties).
 *
 *  - RankStrip on top: flyer thumbs 1…N, current ringed, tap to jump.
 *  - The track: one DeckCard per party; the sponsor (if any) is its own
 *    slide right after #1 (SponsorSlide) and a muted "Ad" marker in the strip.
 *
 * The current slide is read from scroll position (rAF-throttled). Jumps use
 * scrollTo (instant under reduced motion). ←/→ are never hijacked: mouse and
 * keyboard users get prev/next buttons (fine pointers, or on keyboard
 * focus). Off-screen slides are `inert`, so only the current card is in the
 * tab order; a polite live region announces "2 of 7: <title>".
 *
 * Sized by useDeckFrame to the space between the day tabs and the bottom
 * chrome (the Dock or HostTonightPrompt), so Home doesn't scroll vertically.
 * Tapping Home in the Dock while on Home (HomeReselect) jumps back to #1.
 *
 * Analytics: `deck_card_viewed { partyId, rank, day }` once per party per
 * day-view, when a card settles as current (not while flicking past it).
 * The page's handlers keep firing their own events (going_toggled,
 * navigate_clicked); sponsor taps fire sponsor_slot_clicked.
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Party, PartyDay } from '@/lib/types';
import type { SponsorConfig } from '@/lib/sponsors';
import { partyHref } from '@/lib/authHelpers';
import { useDemoMode } from '@/contexts/DemoModeContext';
import { useOnHomeReselect } from '@/contexts/HomeReselectContext';
import { trackEvent } from '@/utils/analytics';
import { buildDeckRows, nightOf, nightPhase } from '@/utils/partyDeck';
import { getDayName } from '@/utils/dateHelpers';
import DeckCard from './DeckCard';
import RankStrip, { DECK_FOCUS_RING, type StripItem } from './RankStrip';
import SponsorSlide from './SponsorSlide';
import useDeckFrame, { DECK_FALLBACK_HEIGHT } from './useDeckFrame';

export interface PartyDeckProps {
  /** The night's parties. Counts must already carry the live overlay (realtime + your RSVP). */
  parties: Party[];
  day: PartyDay;
  /** Real clock on Home (ticking), the frozen snapshot time on /demo. */
  now: Date;
  isGoing: (partyId: string) => boolean;
  /** Logged out: counts arrive null (soft-gate) and render as dashes. */
  loggedOut: boolean;
  onGoingClick: (partyId: string) => void;
  /** Page callback (auth gate + auto-RSVP + analytics); the card also opens maps when the address is known. */
  onNavigateClick: (partyId: string) => void | Promise<void>;
  /** Logged-out carrot: opens login (Home's handleViewAddress). */
  onViewAddress?: (partyId: string) => void;
  /** Slide after #1; null/undefined = no ad. */
  sponsor?: SponsorConfig | null;
  /** /demo: analytics are tagged `demo: true`. */
  readOnly?: boolean;
}

type Slide = StripItem & { key: string };

/** Below this deck height (≈ 375×667 and smaller) the panel tightens. */
const COMPACT_BELOW = 520;
/** How long a card must stay current before it counts as viewed. */
const VIEW_SETTLE_MS = 600;

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export default function PartyDeck({
  parties,
  day,
  now,
  isGoing,
  loggedOut,
  onGoingClick,
  onNavigateClick,
  onViewAddress,
  sponsor,
  readOnly = false,
}: PartyDeckProps) {
  const demo = useDemoMode();
  const rootRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement | null>(null);
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);
  const stripItemRefs = useRef<(HTMLElement | null)[]>([]);

  const frame = useDeckFrame(rootRef);
  const compact = frame ? frame.height < COMPACT_BELOW : false;

  const rows = useMemo(() => buildDeckRows(parties, { now, isGoing }), [parties, now, isGoing]);
  const partyCount = rows.length;

  const slides = useMemo<Slide[]>(() => {
    const list: Slide[] = rows.map((row) => ({ kind: 'party', row, key: row.id }));
    if (sponsor && list.length > 0) list.splice(1, 0, { kind: 'sponsor', key: 'sponsor' });
    return list;
  }, [rows, sponsor]);
  const slideCount = slides.length;
  /** Changes only when the order does — not on every count tick. */
  const orderKey = slides.map((s) => s.key).join('|');

  const isTonight = nightOf(now) === day;
  const nightWord = isTonight ? 'tonight' : getDayName(day);
  const topHyped = useMemo(() => nightPhase(parties, now) !== 'past', [parties, now]);

  const [index, setIndex] = useState(0);
  const indexRef = useRef(0);
  /** Where an in-flight programmatic scroll is headed, so rapid next/next stacks. */
  const pendingRef = useRef<number | null>(null);
  const slidesRef = useRef(slides);
  slidesRef.current = slides;
  /** The slide under your thumb, by key — survives re-ranking when counts move. */
  const currentKeyRef = useRef<string | null>(slides[0]?.key ?? null);

  const stride = useCallback(() => {
    const [a, b] = slideRefs.current;
    if (a && b) return b.offsetLeft - a.offsetLeft;
    return trackRef.current?.clientWidth || 1;
  }, []);

  const commitIndex = useCallback((i: number) => {
    indexRef.current = i;
    currentKeyRef.current = slidesRef.current[i]?.key ?? null;
    setIndex(i);
  }, []);

  // Scroll position → index.
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const i = Math.max(0, Math.min(slideCount - 1, Math.round(track.scrollLeft / stride())));
        if (i === pendingRef.current) pendingRef.current = null;
        if (i !== indexRef.current) commitIndex(i);
      });
    };
    // A finger or wheel takes over from any in-flight jump.
    const onUserScroll = () => {
      pendingRef.current = null;
    };
    track.addEventListener('scroll', onScroll, { passive: true });
    track.addEventListener('touchstart', onUserScroll, { passive: true });
    track.addEventListener('wheel', onUserScroll, { passive: true });
    return () => {
      track.removeEventListener('scroll', onScroll);
      track.removeEventListener('touchstart', onUserScroll);
      track.removeEventListener('wheel', onUserScroll);
      cancelAnimationFrame(raf);
    };
  }, [slideCount, stride, commitIndex]);

  // Order changed (day switch, or an RSVP / live count re-ranked the night):
  // stay on the same party if it's still here, else go back to #1. Instant —
  // nothing replays. Count ticks that don't reorder leave the scroll alone.
  useLayoutEffect(() => {
    const found = slidesRef.current.findIndex((s) => s.key === currentKeyRef.current);
    const i = found >= 0 ? found : 0;
    if (found >= 0 && found === indexRef.current) return;
    const track = trackRef.current;
    if (track) track.scrollLeft = i * stride();
    pendingRef.current = null;
    commitIndex(i);
  }, [orderKey, stride, commitIndex]);

  // Only the current slide is reachable by Tab / interactive for AT.
  useEffect(() => {
    slideRefs.current.forEach((el, i) => {
      if (!el) return;
      if (i === index) el.removeAttribute('inert');
      else el.setAttribute('inert', '');
    });
  }, [index, orderKey]);

  // Keep the current thumb in view when the strip overflows.
  useEffect(() => {
    const strip = stripRef.current;
    const item = stripItemRefs.current[index];
    if (!strip || !item || strip.scrollWidth <= strip.clientWidth) return;
    const left = item.offsetLeft - strip.clientWidth / 2 + item.offsetWidth / 2;
    strip.scrollTo({ left, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  }, [index]);

  // deck_card_viewed: once per party per day-view, after the card settles.
  const viewedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    viewedRef.current = new Set();
  }, [day]);
  const currentKey = slides[index]?.key ?? null;
  useEffect(() => {
    if (!currentKey || currentKey === 'sponsor') return;
    const timer = window.setTimeout(() => {
      const slide = slidesRef.current.find((s) => s.key === currentKey);
      if (!slide || slide.kind !== 'party' || viewedRef.current.has(currentKey)) return;
      viewedRef.current.add(currentKey);
      trackEvent('deck_card_viewed', {
        partyId: currentKey,
        rank: slide.row.rank,
        day,
        ...(readOnly ? { demo: true } : {}),
      });
    }, VIEW_SETTLE_MS);
    return () => window.clearTimeout(timer);
  }, [currentKey, day, readOnly]);

  const goTo = useCallback(
    (i: number) => {
      const track = trackRef.current;
      if (!track) return;
      const target = Math.max(0, Math.min(slideCount - 1, i));
      pendingRef.current = target === indexRef.current ? null : target;
      track.scrollTo({ left: target * stride(), behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    },
    [slideCount, stride],
  );

  // Home tapped while on Home → back to #1.
  useOnHomeReselect(() => goTo(0));

  /** Step from where the deck is headed, not where it is mid-scroll. */
  const step = useCallback((delta: number) => goTo((pendingRef.current ?? indexRef.current) + delta), [goTo]);

  const setStripRef = useCallback((el: HTMLDivElement | null) => {
    stripRef.current = el;
  }, []);
  const setStripItemRef = useCallback((i: number, el: HTMLElement | null) => {
    stripItemRefs.current[i] = el;
  }, []);

  if (slideCount === 0) return null;

  const current = slides[index];
  const announcement = !current
    ? ''
    : current.kind === 'sponsor'
      ? `Sponsored: ${sponsor?.name ?? ''}`
      : `${current.row.rank} of ${partyCount}: ${current.row.party.title}`;

  /** First two party cards preload (current + next on arrival). */
  const priorityIds = new Set(rows.slice(0, 2).map((r) => r.id));

  return (
    <div
      ref={rootRef}
      className="party-deck__enter mx-auto flex w-full max-w-xl flex-col font-montserrat text-white lg:max-w-md"
      style={{
        height: frame ? frame.height : DECK_FALLBACK_HEIGHT,
        marginBottom: frame ? frame.marginBottom : undefined,
      }}
    >
      <RankStrip
        items={slides}
        activeIndex={index}
        compact={compact}
        topHyped={topHyped}
        onJump={goTo}
        stripRef={setStripRef}
        itemRef={setStripItemRef}
      />

      <section
        aria-roledescription="carousel"
        aria-label={isTonight ? 'Tonight’s parties, ranked' : `${getDayName(day)}’s parties, ranked`}
        className="relative min-h-0 flex-1 pb-2 lg:pb-6"
      >
        <div ref={trackRef} className="party-deck__track h-full">
          {slides.map((slide, i) => (
            <div
              key={slide.key}
              ref={(el) => {
                slideRefs.current[i] = el;
              }}
              role="group"
              aria-roledescription="slide"
              aria-label={slide.kind === 'sponsor' ? 'Sponsored' : `${slide.row.rank} of ${partyCount}`}
              className="party-deck__slide h-full"
            >
              {slide.kind === 'sponsor' ? (
                sponsor && <SponsorSlide sponsor={sponsor} compact={compact} readOnly={readOnly} />
              ) : (
                <DeckCard
                  row={slide.row}
                  nightWord={nightWord}
                  topHyped={topHyped}
                  compact={compact}
                  href={partyHref(slide.row.id, demo)}
                  priority={priorityIds.has(slide.row.id)}
                  near={Math.abs(i - index) <= 1}
                  showWings={Math.abs(i - index) <= 2}
                  loggedOut={loggedOut}
                  onGoingClick={onGoingClick}
                  onNavigateClick={onNavigateClick}
                  onViewAddress={onViewAddress}
                />
              )}
            </div>
          ))}
        </div>

        {slideCount > 1 && (
          <>
            <DeckNavButton dir="prev" disabled={index === 0} onClick={() => step(-1)} />
            <DeckNavButton dir="next" disabled={index >= slideCount - 1} onClick={() => step(1)} />
          </>
        )}

        <p className="sr-only" aria-live="polite">
          {announcement}
        </p>
      </section>
    </div>
  );
}

function DeckNavButton({ dir, disabled, onClick }: { dir: 'prev' | 'next'; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      aria-disabled={disabled}
      aria-label={dir === 'prev' ? 'Previous party' : 'Next party'}
      className={`party-deck__nav absolute top-[38%] z-[3] flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white ring-1 ring-inset ring-white/15 ${
        dir === 'prev' ? 'left-6' : 'right-6'
      } ${DECK_FOCUS_RING}`}
    >
      <svg viewBox="0 0 24 24" fill="none" className="size-5" aria-hidden>
        <path
          d={dir === 'prev' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'}
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
