'use client';

/**
 * SponsoredSlot — the dashed "SPONSORED" strip (WF-B2's ad slot). The home
 * feed now shows sponsors as their own deck slide (components/feed/
 * SponsorSlide, reusing openSponsor below); this strip stays for list
 * layouts.
 *
 * Driven entirely by lib/sponsors.ts: a sponsor in the SPONSORS array
 * renders here; an empty array renders nothing (no deal = no ad box).
 * Tapping the strip opens the sponsor's order / site URL.
 *
 * TU Eats: surface-2 card, secondary left rail, muted SPONSORED, white
 * headline, brand in secondary on the subline, external-link icon — no mark.
 */

import DashedCard from '@/components/ui/DashedCard';
import { PRIMARY_SPONSOR, type SponsorConfig } from '@/lib/sponsors';
import { trackEvent } from '@/utils/analytics';

export default function SponsoredSlot() {
  if (!PRIMARY_SPONSOR) return null;
  const sponsor = PRIMARY_SPONSOR;

  if (sponsor.id === 'tueats') {
    return <TuEatsStrip sponsor={sponsor} />;
  }

  return <KitStrip sponsor={sponsor} />;
}

/**
 * Opens the sponsor's URL and fires `sponsor_slot_clicked`. Shared with the
 * feed deck's SponsorSlide (components/feed) so every sponsor tap reports
 * the same event; `extra` adds context (e.g. `{ demo: true }`).
 */
export function openSponsor(sponsor: SponsorConfig, extra?: Record<string, unknown>) {
  trackEvent('sponsor_slot_clicked', { sponsor: sponsor.id, ...extra });
  if (sponsor.orderUrl) window.open(sponsor.orderUrl, '_blank', 'noopener,noreferrer');
}

/** Sister-product treatment: dark card, secondary rail, external-link icon. */
function TuEatsStrip({ sponsor }: { sponsor: SponsorConfig }) {
  const sub = sponsor.tagline ?? sponsor.popupDescription;

  return (
    <div className="mb-3">
      <button
        type="button"
        onClick={() => openSponsor(sponsor)}
        className="relative flex w-full items-center gap-3 overflow-hidden rounded-[12px] border border-white/10 bg-temple-surface-2 py-2.5 pl-4 pr-3 text-left transition-colors hover:border-white/20"
      >
        <span
          className="absolute inset-y-0 left-0 w-[3px] bg-temple-purple-light"
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <p className="font-montserrat text-[8px] font-bold uppercase leading-none tracking-[1.2px] text-temple-muted">
            SPONSORED
          </p>
          <p className="mt-1.5 font-montserrat text-[15px] font-bold leading-5 text-white">
            {sponsor.bannerText}
          </p>
          {sub && (
            <p className="mt-0.5 font-montserrat text-[12px] leading-4 text-temple-muted">
              <span className="font-semibold text-temple-purple-light">
                {sponsor.name}
              </span>
              {' · '}
              {sub}
            </p>
          )}
        </div>
        <svg
          viewBox="0 0 16 16"
          fill="none"
          className="h-4 w-4 shrink-0 text-temple-purple-light"
          aria-hidden
        >
          <path
            d="M6 3.5H3.5A1.5 1.5 0 0 0 2 5v7.5A1.5 1.5 0 0 0 3.5 14H11a1.5 1.5 0 0 0 1.5-1.5V9.5M9.5 2H14v4.5M7.5 8.5 14 2"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  );
}

/** Default kit strip — tuparties purple, for kitchen sponsors. */
function KitStrip({ sponsor }: { sponsor: SponsorConfig }) {
  const mark = sponsor.pinLabel ?? sponsor.name.slice(0, 2);

  return (
    <div className="mb-3">
      <DashedCard
        onClick={() => openSponsor(sponsor)}
        className="flex items-center gap-2.5 py-2.5 pl-2.5 pr-3"
      >
        <div className="flex size-7 shrink-0 items-center justify-center rounded-[6px] bg-temple-purple-light">
          <span className="font-montserrat text-[11px] font-extrabold leading-none text-black">
            {mark}
          </span>
        </div>
        <div className="min-w-0">
          <p className="font-montserrat text-[9.5px] font-bold uppercase tracking-[0.95px] text-temple-muted">
            SPONSORED
          </p>
          <p className="truncate font-montserrat text-[13px] font-semibold text-white">
            {sponsor.name} ·{' '}
            <span className="font-medium text-temple-purple-light">
              {sponsor.popupDescription}
            </span>
          </p>
        </div>
      </DashedCard>
    </div>
  );
}
