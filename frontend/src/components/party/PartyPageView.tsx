'use client';

/**
 * PartyPageView — the party page's presentation, shared by `/party/[id]`
 * (PartyPageClient) and `/demo/party/[id]`. Spec: DESIGN.md decision log,
 * 2026-11-09 "Party page → Deck" — the DeckCard grown up.
 *
 * Top to bottom:
 *   PartyStage       the whole flyer on blurred wings (≤ 60svh) + back disc
 *   PartyInfoPanel   Quiet eyebrow · title · host line · facts line
 *   PartyFactsList   ONE grouped list: When / Where (or the one gate) /
 *                    Tickets / Promo / Going — no number twice
 *   From the host    15/22 body, ≤ 65ch
 *   PartyRating      phase-aware "Was it good?"
 *   PartyActionBar   the one primary + directions + share (sticky)
 *
 * Pure presentation. The page owns state and every rule — auth gates,
 * auto-RSVP, analytics, the demo's local-only session — and hands down a
 * model (utils/partyPage.ts, built from the party with the live overlay
 * already applied) plus callbacks. Toast and InviteModal stay on the page.
 */

import type { ReactNode } from 'react';
import type { Party } from '@/lib/types';
import type { PartyPageModel } from '@/utils/partyPage';
import PartyStage from './PartyStage';
import PartyInfoPanel from './PartyInfoPanel';
import PartyFactsList, { PARTY_QUIET } from './PartyFactsList';
import PartyRating from './PartyRating';
import PartyActionBar from './PartyActionBar';

export interface PartyPageViewProps {
  party: Party;
  model: PartyPageModel;
  /** Back disc target: `/` live, `/demo` in the demo. */
  backHref: string;
  isGoing: boolean;
  /** 1 / 0 / null — this session's vote, else the server's. */
  userRating: number | null;
  /** Rendered above the stage (the demo's DemoBanner). */
  banner?: ReactNode;
  onGoing: () => void;
  onNavigate: () => void;
  onBuyTickets: () => void;
  onRate: (rating: 1 | 0) => void;
  /** `surface` is the analytics surface: 'cta' from the bar. */
  onShare: (surface: string) => void;
  onPromoCopied: (code: string) => void;
  /** The one soft gate (logged out): address + promo code unlock together. */
  onSignIn: () => void;
  onOpenMap: () => void;
  /** Toast hook for small explainers (the verified seal). */
  onShowToast?: (message: string) => void;
}

export default function PartyPageView({
  party,
  model,
  backHref,
  isGoing,
  userRating,
  banner,
  onGoing,
  onNavigate,
  onBuyTickets,
  onRate,
  onShare,
  onPromoCopied,
  onSignIn,
  onOpenMap,
  onShowToast,
}: PartyPageViewProps) {
  return (
    <div className="party-page font-montserrat text-white">
      <article className="party-page__body mx-auto w-full max-w-xl">
        {banner}
        <PartyStage posterImage={party.posterImage} title={party.title} backHref={backHref} />

        <div className="party-page__enter px-4">
          <PartyInfoPanel party={party} model={model} onShowToast={onShowToast} />

          <PartyFactsList
            party={party}
            model={model}
            isGoing={isGoing}
            onSignIn={onSignIn}
            onOpenMap={onOpenMap}
            onBuyTickets={onBuyTickets}
            onPromoCopied={onPromoCopied}
          />

          {party.description && (
            <section aria-labelledby="party-page-from-host" className="mt-8">
              <h2 id="party-page-from-host" className={PARTY_QUIET}>
                From the host
              </h2>
              <p className="mt-2 max-w-[65ch] whitespace-pre-wrap text-pretty text-[15px] leading-[22px] text-white/80">
                {party.description}
              </p>
            </section>
          )}

          <PartyRating model={model} userRating={userRating} onRate={onRate} />
        </div>
      </article>

      <PartyActionBar
        model={model}
        isGoing={isGoing}
        onGoing={onGoing}
        onNavigate={onNavigate}
        onBuyTickets={onBuyTickets}
        onShare={() => onShare('cta')}
      />
    </div>
  );
}
