/**
 * Ranks page model — the pure, React-free rules behind components/ranks/
 * (spec: DESIGN.md decision log, 2026-11-09 "Ranks → Podium").
 *
 * What lives here:
 *  - The period filter: `RankingsFilter`, its options, labels and the
 *    `?filter=` parser /leaderboards deep-links with.
 *  - The ranked / unranked split. Parties rank with ≥ RANK_THRESHOLD ratings
 *    (a UI-only floor — the server sorts by like % then rating count, see
 *    backend/app/routers/ratings.py); hosts rank when the server says
 *    `isEligible` (≥ 2 parties and ≥ 15 ratings, computed in SQL). Both
 *    splits keep the server's order inside each group, so rank = index + 1
 *    in `ranked`, and the unranked group is shown separately — never dimmed
 *    mid-list (ranks-audit.md).
 *  - Small label helpers (vote counts, parties hosted, monograms, the
 *    no-poster tile word) and the podium's visual order.
 *
 * Tested in __tests__/ranks.test.ts.
 */

import type { HostRanking, PartyRanking } from '@/lib/types';

// ─── Period filter ───────────────────────────────────────────────────────────

export type RankingsFilter = 'last-week' | 'this-month' | 'this-semester' | 'by-hosts';

/** Menu order. The owner kept ONE control over stacked tabs (2026-08-17). */
export const RANKINGS_FILTERS: readonly RankingsFilter[] = ['last-week', 'this-month', 'this-semester', 'by-hosts'];

/**
 * `menu` is what the period menu shows (sentence case, like the rest of the
 * app); `sentence` is the lower-case form used inside copy
 * ("#1 last weekend", "No votes yet for this month.").
 */
export const PERIOD_LABELS: Record<RankingsFilter, { menu: string; sentence: string }> = {
  'last-week': { menu: 'Last weekend', sentence: 'last weekend' },
  'this-month': { menu: 'This month', sentence: 'this month' },
  'this-semester': { menu: 'This semester', sentence: 'this semester' },
  'by-hosts': { menu: 'By hosts', sentence: 'hosts' },
};

/** Parse ?filter= from /leaderboards. Unknown or empty values return null. */
export function parseRankingsFilter(raw: string | null | undefined): RankingsFilter | null {
  if (!raw) return null;
  return (RANKINGS_FILTERS as readonly string[]).includes(raw) ? (raw as RankingsFilter) : null;
}

/**
 * Where an empty period's button sends you: a single period → the whole
 * semester; an empty semester → the host ranks; no hosts → the semester.
 */
export function emptyStateNextFilter(filter: RankingsFilter): RankingsFilter {
  if (filter === 'this-semester') return 'by-hosts';
  return 'this-semester';
}

// ─── Thresholds ──────────────────────────────────────────────────────────────

/** A party needs this many ratings before it gets a rank. */
export const RANK_THRESHOLD = 5;

/**
 * Host eligibility is decided server-side (`isEligible`); these two numbers
 * are only for the copy that explains it. Keep them in sync with the SQL
 * (backend/schema 008–013) and HostRankingInfoModal.
 */
export const HOST_MIN_PARTIES = 2;
export const HOST_MIN_VOTES = 15;

// ─── Splits ──────────────────────────────────────────────────────────────────

export interface RankSplit<T> {
  /** Rank = index + 1. Server order kept. */
  ranked: T[];
  /** Below the floor / ineligible. Server order kept. Shown as its own group. */
  unranked: T[];
}

export function splitPartyRankings(rows: readonly PartyRanking[]): RankSplit<PartyRanking> {
  const ranked: PartyRanking[] = [];
  const unranked: PartyRanking[] = [];
  for (const row of rows) (row.ratingCount >= RANK_THRESHOLD ? ranked : unranked).push(row);
  return { ranked, unranked };
}

export function splitHostRankings(rows: readonly HostRanking[]): RankSplit<HostRanking> {
  const ranked: HostRanking[] = [];
  const unranked: HostRanking[] = [];
  for (const row of rows) (row.isEligible ? ranked : unranked).push(row);
  return { ranked, unranked };
}

/**
 * The podium's DOM order = its visual order, #2 · #1 · #3, so Tab and screen
 * readers move left to right like the eye does. Each step still announces
 * its own rank. Takes the top (≤ 3) in rank order.
 */
export function podiumOrder<T>(top: readonly T[]): T[] {
  if (top.length >= 3) return [top[1], top[0], top[2]];
  if (top.length === 2) return [top[1], top[0]];
  return [...top];
}

// ─── Labels ──────────────────────────────────────────────────────────────────

/** "1 vote" / "64 votes" — the sample size always has a unit (ranks-audit.md). */
export function votesLabel(n: number): string {
  return `${n} ${n === 1 ? 'vote' : 'votes'}`;
}

/** "1 party hosted" / "16 parties hosted". */
export function partiesHostedLabel(n: number): string {
  return `${n} ${n === 1 ? 'party' : 'parties'} hosted`;
}

/** Like % as shown: rounded whole number ("91%"). */
export function formatLikePct(pct: number): string {
  return `${Math.round(pct)}%`;
}

/**
 * Host monogram for the logo-less plate: first letters of the first two
 * words ("Latin Heat" → "LH"), one letter for one word, "?" when the name
 * has no letters or digits at all. Punctuation and emoji are skipped.
 */
export function monogram(name: string): string {
  const words = name.split(/[^A-Za-z0-9]+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0][0].toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

const TILE_STOP_WORDS = new Set(['the', 'a', 'an']);

/** Significant words of a title ("The Red Party" → ["Red", "Party"]). */
function titleWords(title: string): string[] {
  const words = title.split(/[^A-Za-z0-9]+/).filter(Boolean);
  const significant = words.filter((w) => !TILE_STOP_WORDS.has(w.toLowerCase()));
  if (significant.length) return significant;
  return words.length ? words : ['?'];
}

/** The word set as type on a no-poster podium flyer ("The Red Party" → "Red"). */
export function posterWord(title: string): string {
  return titleWords(title)[0];
}

/** Two-letter initials for a no-poster row thumb ("Latin Heat Perreo" → "LH"). */
export function posterInitials(title: string): string {
  const w = titleWords(title);
  return (w[0].charAt(0) + (w[1]?.charAt(0) ?? '')).toUpperCase();
}
