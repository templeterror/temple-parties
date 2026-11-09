'use client';

/**
 * SponsorSlide — the sponsor as its own deck slide, right after #1 (owner
 * decision, DESIGN.md 2026-11-07). Same content and link as SponsoredSlot
 * (lib/sponsors.ts → bannerText, name, tagline, orderUrl) and the same
 * `sponsor_slot_clicked` event via SponsoredSlot's openSponsor.
 *
 * The whole slide is one button, like the strip it replaces on the feed.
 * The light-purple left rail is the strip's sponsor cue; no glow, no purple
 * fill — it must never look like a party's primary action.
 */

import type { SponsorConfig } from '@/lib/sponsors';
import { openSponsor } from '@/components/SponsoredSlot';
import { DECK_FOCUS_RING } from './RankStrip';

export default function SponsorSlide({
  sponsor,
  compact,
  readOnly,
}: {
  sponsor: SponsorConfig;
  compact: boolean;
  readOnly: boolean;
}) {
  const sub = sponsor.tagline ?? sponsor.popupDescription;

  return (
    <button
      type="button"
      onClick={() => openSponsor(sponsor, readOnly ? { demo: true } : undefined)}
      aria-label={`Sponsored: ${sponsor.name}. ${sponsor.bannerText}`}
      // No press-scale: a whole-slide scale would fire as a swipe starts.
      className={`relative flex h-full w-full flex-col overflow-hidden rounded-[20px] bg-temple-surface text-left ${DECK_FOCUS_RING}`}
    >
      <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-temple-purple-light" />

      <span className={`block px-5 ${compact ? 'pt-4' : 'pt-5'}`}>
        <span className="text-[10px] font-bold uppercase leading-none tracking-[1.2px] text-temple-muted">
          Sponsored
        </span>
      </span>

      <span className="flex min-h-0 flex-1 flex-col justify-center px-5">
        <span
          className={`block text-balance font-bold text-white ${
            compact ? 'text-[26px] leading-[30px]' : 'text-[32px] leading-[36px]'
          }`}
        >
          {sponsor.bannerText}
        </span>
        {sub && (
          <span className="mt-3 block text-[15px] leading-5 text-temple-muted">
            <span className="font-semibold text-temple-purple-light">{sponsor.name}</span>
            {' · '}
            {sub}
          </span>
        )}
      </span>

      <span className={`block px-4 ${compact ? 'pb-3' : 'pb-4'}`}>
        <span className="flex h-11 w-full items-center justify-center gap-2 rounded-full text-[14px] font-semibold text-temple-purple-light ring-1 ring-inset ring-white/15">
          Open {sponsor.name}
          <svg viewBox="0 0 16 16" fill="none" className="size-4" aria-hidden>
            <path
              d="M6 3.5H3.5A1.5 1.5 0 0 0 2 5v7.5A1.5 1.5 0 0 0 3.5 14H11a1.5 1.5 0 0 0 1.5-1.5V9.5M9.5 2H14v4.5M7.5 8.5 14 2"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </span>

      <span aria-hidden className="pointer-events-none absolute inset-0 rounded-[20px] ring-1 ring-inset ring-white/10" />
    </button>
  );
}
