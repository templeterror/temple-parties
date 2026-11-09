/**
 * partyDeck — the pure model behind the home feed's PartyDeck (DESIGN.md
 * decision log, 2026-11-07 "Feed cards → Deck").
 *
 * React-free and clock-injected: every function takes `now` (or a party) and
 * returns plain data, so the deck, its tests and any future surface (map
 * sheet, share card) agree on who is #1, whether a party is live, how far it
 * is and what it costs.
 *
 * Time rules (US/Eastern, like the backend's weekend math — never the
 * browser's zone):
 *  - doors before 6 AM belong to the night before, so they land on date + 1
 *    (the same 6 AM rollover as getDefaultDay);
 *  - a close at or before doors rolls over to the next calendar day;
 *  - no close → doors + 4h (same live window as the map pins).
 */

import type { Party, PartyDay } from '@/lib/types';
import { displayDoorTime } from '@/utils/dateHelpers';
import { formatCoverPrice } from '@/utils/coverPrice';
import { voteCounts } from '@/utils/ratingHelpers';
import { isLastSemesterChampion } from '@/lib/lastSemesterChampions';

// ─── Ranking ─────────────────────────────────────────────────────────────────

/**
 * The night in deck order: going count, high → low.
 *
 * Counts are taken as given — callers pass parties that already carry the
 * live overlay (realtime ticks + your own RSVP, via useGoingStatus /
 * the demo session), so an RSVP that lifts a party past another moves it up
 * here with no extra bookkeeping. The sort is stable, so ties keep the
 * server's order. Logged out, every count is null (soft-gate): nothing is
 * comparable and the server's order — already going_count desc — stands.
 * A stray null among real counts sorts after them.
 */
export function rankParties<T extends Pick<Party, 'goingCount'>>(parties: readonly T[]): T[] {
  return parties
    .map((party, index) => ({ party, index }))
    .sort((a, b) => {
      const ca = a.party.goingCount;
      const cb = b.party.goingCount;
      if (ca === null && cb === null) return a.index - b.index;
      if (ca === null) return 1;
      if (cb === null) return -1;
      return cb - ca || a.index - b.index;
    })
    .map(({ party }) => party);
}

// ─── Clock ───────────────────────────────────────────────────────────────────

export type Phase = 'past' | 'live' | 'upcoming';

/** Live window when a party has no close time: doors → doors + 4h. */
export const LIVE_HOURS_WITHOUT_CLOSE = 4;

/** Doors with no readable time are treated as 10 PM (same fallback as parseDoorsOpen). */
const DEFAULT_DOORS = { h: 22, m: 0 };

/** "10:30 PM" → { h: 22, m: 30 }; "12 AM" → { h: 0, m: 0 }; null if unparseable. */
function parseClock(text: string | null | undefined): { h: number; m: number } | null {
  if (!text) return null;
  const match = text.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);
  if (!match) return null;
  const hour = parseInt(match[1], 10);
  const minute = match[2] ? parseInt(match[2], 10) : 0;
  if (hour < 1 || hour > 12 || minute > 59) return null;
  return { h: (hour % 12) + (match[3].toUpperCase() === 'PM' ? 12 : 0), m: minute };
}

/** America/New_York offset for a calendar date ("-04:00" / "-05:00"), probed at noon UTC. */
function etOffset(dateISO: string): string {
  const probe = new Date(`${dateISO}T12:00:00Z`);
  const name =
    new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', timeZoneName: 'shortOffset' })
      .formatToParts(probe)
      .find((p) => p.type === 'timeZoneName')?.value ?? 'GMT-5';
  const m = /GMT([+-])(\d{1,2})(?::(\d{2}))?/.exec(name);
  if (!m) return '-05:00';
  return `${m[1]}${m[2].padStart(2, '0')}:${m[3] ?? '00'}`;
}

function addDaysISO(dateISO: string, days: number): string {
  const [y, mo, d] = dateISO.split('-').map(Number);
  return new Date(Date.UTC(y, mo - 1, d + days)).toISOString().slice(0, 10);
}

/** Wall-clock h:m on an ET calendar date → epoch ms. */
function etMs(dateISO: string, h: number, m: number): number {
  const hh = String(h).padStart(2, '0');
  const mm = String(m).padStart(2, '0');
  return new Date(`${dateISO}T${hh}:${mm}:00${etOffset(dateISO)}`).getTime();
}

/** The party's window in ET as epoch ms. See the file header for the rules. */
export function partyWindow(
  party: Pick<Party, 'date' | 'doorsOpen' | 'doorsClose'>,
): { startsAtMs: number; endsAtMs: number } {
  const date = party.date.split('T')[0];
  const doors = parseClock(party.doorsOpen) ?? DEFAULT_DOORS;
  const doorsDate = doors.h < 6 ? addDaysISO(date, 1) : date;
  const startsAtMs = etMs(doorsDate, doors.h, doors.m);

  const close = parseClock(party.doorsClose ?? null);
  let endsAtMs = startsAtMs + LIVE_HOURS_WITHOUT_CLOSE * 3_600_000;
  if (close) {
    endsAtMs = etMs(doorsDate, close.h, close.m);
    if (endsAtMs <= startsAtMs) endsAtMs = etMs(addDaysISO(doorsDate, 1), close.h, close.m);
  }
  return { startsAtMs, endsAtMs };
}

/** past: now ≥ end · live: doors ≤ now < end · upcoming: before doors. */
export function phaseAt(
  party: Pick<Party, 'date' | 'doorsOpen' | 'doorsClose'>,
  now: Date | number,
): Phase {
  const t = typeof now === 'number' ? now : now.getTime();
  const { startsAtMs, endsAtMs } = partyWindow(party);
  if (t >= endsAtMs) return 'past';
  if (t >= startsAtMs) return 'live';
  return 'upcoming';
}

/**
 * A whole night's phase: past once every party on it is over, live while
 * any party is, upcoming otherwise. Drives the `#1 tonight` chip — hyped
 * yellow + glow on upcoming/live nights, muted on past ones.
 */
export function nightPhase(
  parties: readonly Pick<Party, 'date' | 'doorsOpen' | 'doorsClose'>[],
  now: Date | number,
): Phase {
  if (parties.length === 0) return 'upcoming';
  const phases = parties.map((p) => phaseAt(p, now));
  if (phases.every((p) => p === 'past')) return 'past';
  if (phases.some((p) => p === 'live')) return 'live';
  return 'upcoming';
}

/** Which party night `now` falls in, in ET with the 6 AM rollover; null Sun–Wed. */
export function nightOf(now: Date | number): PartyDay | null {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
    hour: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(new Date(now));
  const weekday = parts.find((p) => p.type === 'weekday')?.value ?? '';
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '12');
  let idx = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(weekday);
  if (hour < 6) idx = (idx + 6) % 7;
  if (idx === 4) return 'thursday';
  if (idx === 5) return 'friday';
  if (idx === 6) return 'saturday';
  return null;
}

// ─── Distance ────────────────────────────────────────────────────────────────

/** Temple's Bell Tower — the campus "from here" for walk times (no location permission). */
export const BELL_TOWER = { lat: 39.9812, lng: -75.155 } as const;
const WALK_METERS_PER_MINUTE = 80;

export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/**
 * Straight-line walking minutes from the Bell Tower at 80 m/min, rounded up,
 * never below 1. null when the coordinates are missing or (0, 0) — the card
 * then drops the fact instead of claiming a 5,000-minute walk.
 */
export function walkMinutesFromBellTower(lat: number | null | undefined, lng: number | null | undefined): number | null {
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) return null;
  const meters = haversineMeters(BELL_TOWER.lat, BELL_TOWER.lng, lat, lng);
  return Math.max(1, Math.ceil(meters / WALK_METERS_PER_MINUTE));
}

// ─── Price + counts ──────────────────────────────────────────────────────────

export interface PriceLabels {
  /** What the card prints: 'Free', 'Tickets', or the host's own text ("$15 presale / $20 door"). */
  priceLabel: string;
  /** Tile-safe via utils/coverPrice: 'Free' | '$N' | '—' (unreadable, or ticketed with no price). */
  priceShort: string;
  /** Has a price or a ticket link (i.e. not plainly free). */
  isTicketed: boolean;
}

export function priceLabels(party: Pick<Party, 'ticketPrice' | 'ticketUrl'>): PriceLabels {
  const text = (party.ticketPrice ?? '').trim();
  const hasLink = !!party.ticketUrl;
  if (!text) {
    return hasLink
      ? { priceLabel: 'Tickets', priceShort: '—', isTicketed: true }
      : { priceLabel: 'Free', priceShort: 'Free', isTicketed: false };
  }
  const short = formatCoverPrice(text);
  if (short === 'FREE') return { priceLabel: 'Free', priceShort: 'Free', isTicketed: hasLink };
  return { priceLabel: text, priceShort: short ?? '—', isTicketed: true };
}

/** 64 → "64"; 1204 → "1.2k"; 12_400 → "12k"; null (soft-gated) → "—", never a fake 0. */
export function formatGoing(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  if (n >= 1000) {
    const k = n / 1000;
    return `${k >= 10 ? Math.round(k) : Math.round(k * 10) / 10}k`;
  }
  return String(n);
}

/** Card label for a category: "Other" (or blank) carries no information, so it gets no label. */
export function meaningfulCategory(category: string | null | undefined): string | null {
  const c = (category ?? '').trim();
  return c && c.toLowerCase() !== 'other' ? c : null;
}

// ─── Rows ────────────────────────────────────────────────────────────────────

/** Everything one deck card renders, computed once per party per render. */
export interface DeckRow {
  party: Party;
  id: string;
  /** 1-based position among the night's parties (sponsor slides don't count). */
  rank: number;
  isTop: boolean;
  /** As given (live overlay already applied); null when soft-gated. */
  goingCount: number | null;
  isGoing: boolean;
  phase: Phase;
  /** "10 PM", "10:30 PM". */
  doorsLabel: string;
  priceLabel: string;
  walkMinutes: number | null;
  /** Host track record — only when the payload carries hostStats (feed rows usually don't). */
  hostLikePct: number | null;
  isChampion: boolean;
  /** Per-party votes; null when soft-gated. */
  votes: { like: number; dislike: number } | null;
}

/** One DeckRow per party, in rank order. */
export function buildDeckRows(
  parties: readonly Party[],
  { now, isGoing }: { now: Date | number; isGoing: (id: string) => boolean },
): DeckRow[] {
  return rankParties(parties).map((party, i) => {
    const v = voteCounts(party.likePercentage, party.ratingCount);
    return {
      party,
      id: party.id,
      rank: i + 1,
      isTop: i === 0,
      goingCount: party.goingCount,
      isGoing: isGoing(party.id),
      phase: phaseAt(party, now),
      doorsLabel: displayDoorTime(party.doorsOpen ?? ''),
      priceLabel: priceLabels(party).priceLabel,
      walkMinutes: walkMinutesFromBellTower(party.latitude, party.longitude),
      hostLikePct: party.hostStats?.avgLikePercentage ?? null,
      isChampion: isLastSemesterChampion(party.host),
      votes: v ? { like: v.likeCount, dislike: v.dislikeCount } : null,
    };
  });
}
