'use client';

/**
 * PartyFactsList — ONE grouped `temple-surface` list, hairline-separated,
 * carrying only what the facts line above it doesn't (the no-repeat rule
 * lives in utils/partyPage.ts):
 *
 *   When     date + `until 2 AM` (upcoming) / `10 PM–2 AM` (live, ended)
 *   Where    street + city, `Open in map` (→ /map?party=<id>). Logged out
 *            this row IS the page's one soft gate: one sentence, one Sign in
 *            (the address and the promo code unlock together).
 *   Tickets  `Tickets on posh.vip ↗` — ticketed parties only; never the price
 *   Promo    label, code, hint, Copy → ✓ for 1.5s (logged out: label + hint)
 *   Going    `186 going` / `went`; `—` when soft-gated, never a fake 0
 *
 * Each row leads with a 20px line icon (PartyIcons) and names itself to
 * screen readers ("When: …"); the icons are decorative. Hairlines are inset
 * to the text column — `.party-page__row` in globals.css.
 */

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { DECK_FOCUS_RING } from '@/components/feed/RankStrip';
import { copyText } from '@/utils/shareHelpers';
import type { Party } from '@/lib/types';
import type { PartyPageModel } from '@/utils/partyPage';
import { CalendarIcon, CheckIcon, PeopleIcon, PinIcon, TagIcon, TicketIcon } from './PartyIcons';

/** Outlined secondary control — the Deck's directions / Details language. Callers set the text colour. */
export const PARTY_GHOST = `party-page__ghost party-page__press ring-1 ring-inset ring-white/15 ${DECK_FOCUS_RING}`;
/** The Quiet label: muted 12px semibold tracked caps, no box. */
export const PARTY_QUIET = 'text-[12px] font-semibold uppercase leading-4 tracking-[0.08em] text-temple-muted';

const MAIN = 'text-[15px] leading-5 text-white';
const SUB = 'mt-0.5 text-[13px] leading-[18px] text-white/60';

interface PartyFactsListProps {
  party: Party;
  model: PartyPageModel;
  isGoing: boolean;
  /** The one soft gate's Sign in. */
  onSignIn: () => void;
  /** Open in map — the page tracks + routes. */
  onOpenMap: () => void;
  /** The ticket-site link was clicked (the <a> opens it itself). */
  onBuyTickets: () => void;
  /** After a successful copy, so the page can toast + track. */
  onPromoCopied: (code: string) => void;
}

export default function PartyFactsList({
  party,
  model,
  isGoing,
  onSignIn,
  onOpenMap,
  onBuyTickets,
  onPromoCopied,
}: PartyFactsListProps) {
  const hasPromo = !!party.promoLabel;
  const gateCopy = hasPromo
    ? 'Sign in with your .edu to see the address and promo code'
    : 'Sign in with your .edu to see the address';

  return (
    <ul className="mt-5 overflow-hidden rounded-[16px] bg-temple-surface">
      <Row icon={<CalendarIcon />} label="When">
        <p className={MAIN}>
          <span className="font-semibold">{model.whenDate}</span>
          {model.whenTime && <span className="text-white/70"> · {model.whenTime}</span>}
        </p>
      </Row>

      {model.gated ? (
        <Row icon={<PinIcon />} label="Where">
          <p className={`${MAIN} text-pretty`}>{gateCopy}</p>
          <button
            type="button"
            onClick={onSignIn}
            className={`${PARTY_GHOST} mt-3 h-11 text-white rounded-full px-5 text-[14px] font-semibold`}
          >
            Sign in
          </button>
        </Row>
      ) : (
        <Row
          icon={<PinIcon />}
          label="Where"
          trailing={
            <button
              type="button"
              onClick={onOpenMap}
              className={`${PARTY_GHOST} flex h-11 shrink-0 items-center rounded-full px-4 text-white text-[13px] font-semibold`}
            >
              Open in map
            </button>
          }
        >
          <p className={`${MAIN} font-semibold [overflow-wrap:anywhere]`}>{model.addressLine}</p>
          {model.addressRest && <p className={SUB}>{model.addressRest}</p>}
        </Row>
      )}

      {model.ticketUrl && model.ticketLinkLabel && (
        <Row icon={<TicketIcon />} label="Tickets">
          <a
            href={model.ticketUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onBuyTickets}
            className={`-my-3 flex min-h-11 items-center rounded-[6px] ${MAIN} font-semibold [overflow-wrap:anywhere] ${DECK_FOCUS_RING}`}
          >
            {model.ticketLinkLabel}
            <span aria-hidden>&nbsp;↗</span>
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </Row>
      )}

      {party.promoLabel && (
        <PromoRow
          label={party.promoLabel}
          code={party.promoCode ?? null}
          hint={party.promoHint ?? null}
          onCopied={onPromoCopied}
        />
      )}

      <Row icon={<PeopleIcon />} label="Going">
        <p className={`${MAIN} tabular-nums`}>
          <span className={`font-semibold ${model.goingGated ? 'text-temple-muted' : ''}`}>{model.goingLabel}</span>
          <span className="text-white/70"> {model.goingWord}</span>
        </p>
        {isGoing && <p className={SUB}>Including you</p>}
      </Row>
    </ul>
  );
}

function Row({
  icon,
  label,
  children,
  trailing,
}: {
  icon: ReactNode;
  /** Screen-reader row name ("When"); the icon carries it visually. Omit when the row's text names itself. */
  label?: string;
  children: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <li className="party-page__row flex pl-4">
      <span aria-hidden className="flex w-5 shrink-0 justify-center pt-[15px] text-temple-muted">
        {icon}
      </span>
      <div className="party-page__row-body ml-3 flex min-w-0 flex-1 items-center gap-3 py-3.5 pr-4">
        <div className="min-w-0 flex-1">
          {label && <span className="sr-only">{label}: </span>}
          {children}
        </div>
        {trailing}
      </div>
    </li>
  );
}

/**
 * Promo: label + code + hint, Copy → ✓ for 1.5s. The server strips the code
 * for logged-out callers (null stays null — hiding it client-side alone
 * would leak it in the response), so then the row is the carrot: label +
 * hint, and the gate above explains how to unlock it.
 */
function PromoRow({
  label,
  code,
  hint,
  onCopied,
}: {
  label: string;
  code: string | null;
  hint: string | null;
  onCopied: (code: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const handleCopy = async () => {
    if (!code || !(await copyText(code))) return;
    onCopied(code);
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Row
      icon={<TagIcon />}
      trailing={
        code ? (
          <button
            type="button"
            onClick={handleCopy}
            aria-label={copied ? 'Promo code copied' : `Copy promo code ${code}`}
            data-copied={copied || undefined}
            className={`${PARTY_GHOST} party-page__swap relative h-11 w-[84px] text-white shrink-0 rounded-full text-[13px] font-semibold`}
          >
            <span className="party-page__swap-idle absolute inset-0 flex items-center justify-center">Copy</span>
            <span className="party-page__swap-done absolute inset-0 flex items-center justify-center text-temple-purple-light">
              <CheckIcon />
            </span>
          </button>
        ) : undefined
      }
    >
      <p className={PARTY_QUIET}>
        Promo<span aria-hidden> · </span>
        {label}
      </p>
      {code && (
        <p className="mt-1 text-[17px] font-bold leading-6 tracking-[0.06em] text-white [overflow-wrap:anywhere]">
          {code}
        </p>
      )}
      {hint && <p className={`${SUB} text-pretty`}>{hint}</p>}
      {/* The page Toast isn't a live region; this is what a screen reader hears. */}
      <span className="sr-only" aria-live="polite">
        {copied ? 'Promo code copied' : ''}
      </span>
    </Row>
  );
}
