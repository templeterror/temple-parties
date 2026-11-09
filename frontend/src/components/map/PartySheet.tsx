'use client';

/**
 * PartySheet — the bottom drawer that opens when you tap a map pin
 * (Figma §13, WF-M3). It replaces the old floating Leaflet popup, which
 * clipped on phones and sat on top of the very pin it belonged to.
 *
 * Reads top to bottom the way a student decides:
 *   poster + tags + title + who's hosting
 *   → the party page's stat row, map edition: COVER / STARTS / SHARE
 *   → where (address, gated for logged-out) beside the read-only votes
 *   → GOING (the count lives on the button) + navigate, same pair as the
 *     party page's sticky bar.
 *
 * Gestures: drag the sheet down past ~90px to close it; drag it up ~150px
 * to push the full party page (a short flick is not enough). Tap the header
 * to open the party page too. Escape or tapping the dimmed map closes.
 *
 * Positioning: absolute inside the map wrapper, not fixed — so it always
 * lives above the map tiles. While it's open the page hides the mobile tab
 * bar, and the sheet sits on the bottom of the screen. Extra bottom padding
 * clears the iOS Safari URL bar (safe-area-inset only covers the home
 * indicator, not the overlay toolbar).
 *
 * Material: Apple-style frost, the same rules the host prompt uses — the
 * `.party-sheet*` selectors are comma-joined onto `.host-tonight-prompt*`
 * in globals.css so the two drawers can never drift apart. The blur lives
 * on an absolutely positioned `__glass` layer with the content painting
 * above it; the GOING button is frost-on-primary and the stat tiles are
 * translucent light purple. Under `prefers-reduced-transparency` the whole
 * thing falls back to the solid `#252528` surface.
 */

import { forwardRef, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import type { Party } from '@/lib/types';
import type { HostBrand, PartyPhase } from '@/utils/mapHelpers';
import { coverStat } from '@/utils/mapHelpers';
import { displayDoorTime } from '@/utils/dateHelpers';
import { voteCounts } from '@/utils/ratingHelpers';
import GoingButton from '@/components/GoingButton';
import Pill from '@/components/ui/Pill';
import StatTile from '@/components/ui/StatTile';
import VoteRow from '@/components/ui/VoteRow';
import NavigateIcon from '@/components/ui/NavigateIcon';
import ShareIcon from '@/components/ui/ShareIcon';
import { VerifiedSealIcon } from '@/components/ui/VerifiedMark';

interface PartySheetProps {
  party: Party;
  /** Null for a disc (free) party: the poster thumb gets a plain hairline instead of a brand ring. */
  brand: HostBrand | null;
  isHeadliner: boolean;
  phase: PartyPhase;
  userIsGoing: boolean;
  onClose: () => void;
  onGoingClick: () => void;
  onNavigateClick: () => void;
  onOpenParty: (via: 'tap' | 'swipe_up') => void;
  onShare: () => void;
}

/** Drag thresholds in px of actual finger travel. Up is a longer pull so a
 *  short flick on the grabber doesn't accidentally open the party page. */
const CLOSE_DRAG_PX = 90;
const OPEN_DRAG_PX = -150;

/** Street line only ("1629 W Diamond St") — the pin already shows where. */
function shortAddress(address: string | null): string {
  if (!address) return 'Sign in for address';
  return address.split(',')[0];
}

const PartySheet = forwardRef<HTMLDivElement, PartySheetProps>(function PartySheet(
  { party, brand, isHeadliner, phase, userIsGoing, onClose, onGoingClick, onNavigateClick, onOpenParty, onShare },
  ref,
) {
  // Drag state: how far the sheet has been pulled, and whether a pointer is
  // currently down (so we can turn the snap-back transition off mid-drag).
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startY = useRef<number | null>(null);
  const lastDy = useRef(0);
  // Set once the pointer has moved a few px — a header "tap" that was really
  // the start of a drag must not open the party page.
  const moved = useRef(false);

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    // Buttons keep their normal taps; only the sheet body drags.
    if ((e.target as HTMLElement).closest('button, a')) return;
    startY.current = e.clientY;
    lastDy.current = 0;
    moved.current = false;
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (startY.current === null) return;
    const dy = e.clientY - startY.current;
    lastDy.current = dy;
    if (Math.abs(dy) > 6) moved.current = true;
    // Upward drag is visually damped so the sheet doesn't fly off-screen;
    // the open/close decision below uses lastDy (real finger travel).
    setDragY(dy > 0 ? dy : dy / 3);
  };

  const onPointerUp = () => {
    if (startY.current === null) return;
    startY.current = null;
    setDragging(false);
    const dy = lastDy.current;
    lastDy.current = 0;
    if (dy > CLOSE_DRAG_PX) {
      onClose();
      return;
    }
    if (dy < OPEN_DRAG_PX) {
      onOpenParty('swipe_up');
      return;
    }
    setDragY(0);
  };

  const onHeaderClick = () => {
    if (moved.current) return;
    onOpenParty('tap');
  };

  const onHeaderKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onOpenParty('tap');
    }
  };

  const votes = voteCounts(party.likePercentage, party.ratingCount);
  const cover = coverStat(party);
  const hostedLine = party.hostStats?.partiesHosted
    ? ` · ${party.hostStats.partiesHosted} ${party.hostStats.partiesHosted === 1 ? 'party' : 'parties'} hosted`
    : '';

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={party.title}
      className="party-sheet absolute inset-x-0 bottom-0 z-[1200] lg:max-w-[480px] lg:mx-auto animate-sheet-in"
      style={{
        transform: `translateY(${Math.max(dragY, -72)}px)`,
        transition: dragging ? 'none' : 'transform 200ms ease-out',
        touchAction: 'none',
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div className="relative rounded-t-[24px]">
        <div className="party-sheet__glass" aria-hidden />

        <div className="relative flex flex-col gap-3.5 pb-[calc(env(safe-area-inset-bottom)+2.75rem)] lg:pb-5">
          {/* Grabber — the visual hint that this thing drags. */}
          <div className="flex justify-center pt-2.5">
            <div className="w-9 h-1 rounded-full bg-temple-purple-light/45" />
          </div>

          {/* Header: poster + tags + title + host. The whole block is the tap
              target for the full party page (mirrors the feed-card rule). */}
          <div
            role="button"
            tabIndex={0}
            aria-label={`View ${party.title}`}
            onClick={onHeaderClick}
            onKeyDown={onHeaderKey}
            className="flex items-start gap-3 px-5 pt-1 min-w-0 cursor-pointer"
          >
              {/* Poster thumb, ringed in the host's brand colour — the sheet
                  inherits the pin's identity. Free parties get a hairline. */}
              <div
                className="size-[72px] shrink-0 rounded-[12px] overflow-hidden bg-temple-surface-2"
                style={{ border: `2px solid ${brand ? brand.primary : 'rgba(255,255,255,0.1)'}` }}
              >
                {party.posterImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={party.posterImage} alt="" className="size-full object-cover" />
                ) : (
                  <div className="size-full flex items-center justify-center">
                    <span className="font-montserrat font-bold text-[18px] text-temple-purple-light">
                      {party.host.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0 flex flex-col gap-[5px]">
                {/* One identity chip (HEADLINER wins over the category) plus the
                    LIVE NOW tag while doors are open — in the host's accent. */}
                <div className="flex items-center gap-1.5">
                  {isHeadliner ? (
                    <Pill tone="hyped" shape="square">HEADLINER</Pill>
                  ) : (
                    <Pill tone="neutral" shape="square">{party.category}</Pill>
                  )}
                  {phase === 'live' && (
                    <span
                      className="inline-flex items-center justify-center uppercase font-montserrat font-bold whitespace-nowrap text-[8.5px] tracking-[0.68px] px-[7px] py-[3px] rounded"
                      style={{ background: brand?.accent ?? '#b24bf3', color: brand?.accentInk ?? '#ffffff' }}
                    >
                      LIVE NOW
                    </span>
                  )}
                </div>

                <h3 className="font-montserrat font-bold text-[18px] leading-[22px] text-white line-clamp-2">
                  {party.title}
                </h3>

                <p className="font-montserrat font-medium text-[11px] text-white/75 flex items-center gap-1 min-w-0">
                  <span className="truncate">
                    by {party.host}
                  </span>
                  {party.isVerified && <VerifiedSealIcon size={12} className="shrink-0" />}
                  {hostedLine && <span className="truncate">{hostedLine}</span>}
                </p>
              </div>
          </div>

          {/* Same row as the party page (COVER / GOING / SHARE), with the door
              time in the middle seat — going already lives on the big button.
              Tiles are the frost's translucent light purple here so the glass
              reads through them (StatTile's solid default would punch a hole
              in the material). The share tile is copied from the party page
              verbatim so the two rows never drift apart. */}
          <div className="flex gap-2 px-5">
            <StatTile value={cover.value} label={cover.label} className="party-sheet__tile" />
            <StatTile value={displayDoorTime(party.doorsOpen)} label="STARTS" className="party-sheet__tile" />
            <button
              type="button"
              onClick={onShare}
              aria-label="Share this party"
              className="flex-1 min-w-0 flex flex-col items-center justify-center gap-[3px] py-3 rounded-[12px] bg-temple-purple-light text-black hover:opacity-90 active:scale-[0.98] transition-all duration-150"
            >
              <ShareIcon className="w-4 h-4" />
              <span className="font-montserrat font-bold text-[9px] tracking-[0.9px] uppercase">
                SHARE
              </span>
            </button>
          </div>

          {/* Where + the read-only votes on one line (rating happens on the
              party page). The address is the soft-gate carrot: logged-out
              readers see "Sign in for address" here. */}
          <div className="flex items-center justify-between gap-3 px-5">
            <p className="font-montserrat font-semibold text-[12px] text-white truncate">
              {shortAddress(party.address)}
            </p>
            <VoteRow
              likeCount={votes?.likeCount ?? null}
              dislikeCount={votes?.dislikeCount ?? null}
              userRating={null}
              state={party.ratingLocked ? 'locked' : party.ratingOpen ? 'open' : 'inactive'}
              size="sm"
            />
          </div>

          {/* GOING is the one big button (it carries the count); navigate rides
              beside it in its light-purple seat, exactly like the party page's
              sticky bar. Navigate stays enabled logged-out — the handler
              soft-gates to login, and the address is what brings people back. */}
          <div className="flex items-stretch gap-2 px-5 pt-1">
            <div className="flex-1 min-w-0 flex">
              <GoingButton currentCount={party.goingCount} userIsGoing={userIsGoing} onGoingClick={onGoingClick} variant="bar" className="party-sheet__cta" />
            </div>
            <button
              type="button"
              onClick={onNavigateClick}
              aria-label="Navigate"
              title="Opens walking directions"
              className="size-12 shrink-0 rounded-[12px] bg-temple-purple-light text-temple-purple flex items-center justify-center hover:opacity-90 active:scale-[0.98] transition-all"
            >
              <NavigateIcon className="w-[18px] h-[18px]" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

export default PartySheet;
