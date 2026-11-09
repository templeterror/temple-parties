/**
 * Party page model — the pure, React-free rules behind the party page
 * (`/party/[id]` and its demo twin), composed by components/party/PartyPageView
 * (spec: DESIGN.md decision log, 2026-11-09 "Party page → Deck").
 *
 * The page is the DeckCard grown up, so everything the card already knows
 * comes from utils/partyDeck.ts — phase in ET, walk minutes, price labels,
 * `formatGoing`, the `Other`-is-no-category rule — never a second copy.
 * What lives here is what only the page says:
 *
 *  - The no-repeat rule. The facts line under the title carries the door
 *    state (`Doors 10 PM` / `Live now` / `Ended`), the price and the walk;
 *    the grouped list below carries only what the line left out: the date
 *    plus `until 2 AM` (upcoming) or the `10 PM–2 AM` span (live / ended),
 *    the address, the ticket SITE (never the price again), the promo and
 *    the going count. No number appears twice.
 *  - The eyebrow: `#1 tonight` / `#1 Saturday` only while the top party is
 *    live or upcoming (an ended night has no "top party tonight").
 *  - The rating section's mode. It follows the SERVER's window — votes are
 *    accepted from doors until Monday 11:59 PM ET (backend
 *    weekend_service.rating_window) — so the morning after a party is still
 *    a voting day; the clock phase only picks the copy.
 *
 * Clock-injected: callers pass `now` (real time in production,
 * `demoNowDate()` in the demo). Counts are taken as given — pass the party
 * with the live overlay (your RSVP / vote) already applied; soft-gated
 * nulls stay null and come out as `—` / count-less copy, never fake zeros.
 *
 * Tested in __tests__/partyPage.test.ts.
 */

import type { Party } from '@/lib/types';
import { ratingWindowState, type RatingWindowState } from '@/components/ui/VoteRow';
import { displayDoorTime, getDayName } from '@/utils/dateHelpers';
import { voteCounts } from '@/utils/ratingHelpers';
import { isLastSemesterChampion } from '@/lib/lastSemesterChampions';
import {
  formatGoing,
  meaningfulCategory,
  nightOf,
  phaseAt,
  priceLabels,
  walkMinutesFromBellTower,
} from '@/utils/partyDeck';

/** The page's own word for the Deck's `past`. */
export type PartyPhase = 'upcoming' | 'live' | 'ended';

/**
 * The rating section:
 *  - `before`: doors haven't opened — one quiet line, no panel.
 *  - `open`: vote buttons + the result so far.
 *  - `closed`: the result + `Voting closed` (server locked it).
 */
export type RatingMode = 'before' | 'open' | 'closed';

/** Host free-text prices longer than this ride on their own facts line. */
export const INLINE_PRICE_MAX = 10;

export interface PartyPageInput {
  /** The party with the live overlay already applied (going / votes). */
  party: Party;
  now: Date | number;
  /** #1 on its night: the detail endpoint's `isHeadliner`, or the demo session's top id. */
  isTop: boolean;
}

export interface PartyPageModel {
  phase: PartyPhase;

  // ── Eyebrow ──
  /** "#1 tonight" / "#1 Saturday" — only for the top party while live or upcoming. */
  topLabel: string | null;
  /** "Frat Party"; null for `Other` / blank (Quiet rule). */
  category: string | null;

  // ── Facts line (under the title) ──
  /** "Doors 10 PM" | "Live now" | "Ended". */
  doorLabel: string;
  /** "Free" | "Tickets" | "$5" | host text ("$15 presale / $20 door"). */
  priceLabel: string;
  /** Short prices ride inline; long host text gets its own line, whole. */
  priceInline: boolean;
  /** Straight-line minutes from the Bell Tower; null without coordinates. */
  walkMinutes: number | null;

  // ── Host line ──
  /** "90% liked · 9 parties" — only when the detail payload carries hostStats. */
  hostStatsLine: string | null;
  isChampion: boolean;

  // ── The grouped list ──
  /** "Fri, Apr 10". */
  whenDate: string;
  /** What the facts line left out: "until 2 AM" (upcoming), "10 PM–2 AM" / "10 PM" (live, ended), or null. */
  whenTime: string | null;
  /** Soft gate: the server nulled the address (logged out). This row IS the one gate. */
  gated: boolean;
  /** "1535 N Carlisle St" — the first comma segment. */
  addressLine: string | null;
  /** "Philadelphia, PA 19121" — the rest, or null. */
  addressRest: string | null;
  /** Has a ticket link → `Buy tickets ↗` is the primary and the list gets a ticket-site row. */
  ticketed: boolean;
  ticketUrl: string | null;
  /** "Tickets on posh.vip" | "Tickets online". Null when not ticketed. */
  ticketLinkLabel: string | null;
  /** "186" | "1.2k" | "—" (soft-gated). */
  goingLabel: string;
  /** True when the server nulled the count — the label renders muted. */
  goingGated: boolean;
  /** "going" | "went". */
  goingWord: string;

  // ── Rating ──
  ratingWindow: RatingWindowState;
  ratingMode: RatingMode;
  /** "90% liked · 64 votes" | "No votes yet" | null (soft-gated). */
  voteResult: string | null;

  // ── Action bar ──
  /** Nothing left to do but tell people: the party is over and voting has closed. */
  shareOnly: boolean;
}

const PHASE: Record<ReturnType<typeof phaseAt>, PartyPhase> = { past: 'ended', live: 'live', upcoming: 'upcoming' };

/** "2026-04-10" (or an ISO timestamp) → "Fri, Apr 10". UTC on both sides so every zone agrees. */
export function shortDate(iso: string): string {
  const [y, m, d] = iso.split('T')[0].split('-').map(Number);
  if (!y || !m || !d) return iso;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * The When row's time — only what the facts line left out. Upcoming, the
 * line already says `Doors 11 PM`, so the row adds `until 2 AM` (or
 * nothing). Live / ended, the line says `Live now` / `Ended`, so the row
 * carries the span `10 PM–2 AM` (en dash) or the bare doors time.
 */
export function whenTime(
  party: Pick<Party, 'doorsOpen' | 'doorsClose'>,
  phase: PartyPhase,
): string | null {
  const doors = displayDoorTime(party.doorsOpen ?? '');
  const close = party.doorsClose ? displayDoorTime(party.doorsClose) : null;
  if (phase === 'upcoming') return close ? `until ${close}` : null;
  return close ? `${doors}–${close}` : doors;
}

/** "https://www.posh.vip/e/x?ref=tuparty" → "posh.vip"; null when unparseable. */
export function ticketSiteHost(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    return host || null;
  } catch {
    return null;
  }
}

/** "90% liked · 64 votes" | "No votes yet" | null when soft-gated. */
export function voteResultLine(likePct: number | null, ratingCount: number | null): string | null {
  const v = voteCounts(likePct, ratingCount);
  if (!v || likePct === null) return null;
  const total = v.likeCount + v.dislikeCount;
  if (total === 0) return 'No votes yet';
  return `${Math.round(likePct)}% liked · ${total} ${total === 1 ? 'vote' : 'votes'}`;
}

/** See the file header: the server window decides; upcoming is always `before`. */
export function ratingMode(win: RatingWindowState, phase: PartyPhase): RatingMode {
  if (win === 'locked') return 'closed';
  if (win === 'inactive' || phase === 'upcoming') return 'before';
  return 'open';
}

export function buildPartyPage({ party, now, isTop }: PartyPageInput): PartyPageModel {
  const phase = PHASE[phaseAt(party, now)];
  const doors = displayDoorTime(party.doorsOpen ?? '');
  const price = priceLabels(party);
  const stats = party.hostStats ?? null;
  const win = ratingWindowState(party.ratingOpen ?? false, party.ratingLocked ?? false);
  const mode = ratingMode(win, phase);

  const address = party.address;
  const comma = address ? address.indexOf(',') : -1;
  const addressLine = address ? (comma === -1 ? address : address.slice(0, comma)).trim() : null;
  const addressRest = address && comma !== -1 ? address.slice(comma + 1).trim() || null : null;

  const ticketUrl = party.ticketUrl || null;
  const site = ticketSiteHost(ticketUrl);

  const nightWord = nightOf(now) === party.day ? 'tonight' : getDayName(party.day);

  return {
    phase,

    topLabel: isTop && phase !== 'ended' ? `#1 ${nightWord}` : null,
    category: meaningfulCategory(party.category),

    doorLabel: phase === 'live' ? 'Live now' : phase === 'ended' ? 'Ended' : `Doors ${doors}`,
    priceLabel: price.priceLabel,
    priceInline: price.priceLabel.length <= INLINE_PRICE_MAX,
    walkMinutes: walkMinutesFromBellTower(party.latitude, party.longitude),

    hostStatsLine: stats
      ? `${Math.round(stats.avgLikePercentage)}% liked · ${stats.partiesHosted} ${stats.partiesHosted === 1 ? 'party' : 'parties'}`
      : null,
    isChampion: isLastSemesterChampion(party.host),

    whenDate: shortDate(party.date),
    whenTime: whenTime(party, phase),
    gated: address === null,
    addressLine,
    addressRest,
    ticketed: !!ticketUrl,
    ticketUrl,
    ticketLinkLabel: ticketUrl ? (site ? `Tickets on ${site}` : 'Tickets online') : null,
    goingLabel: formatGoing(party.goingCount),
    goingGated: party.goingCount === null,
    goingWord: phase === 'ended' ? 'went' : 'going',

    ratingWindow: win,
    ratingMode: mode,
    voteResult: voteResultLine(party.likePercentage, party.ratingCount),

    shareOnly: phase === 'ended' && mode === 'closed',
  };
}
