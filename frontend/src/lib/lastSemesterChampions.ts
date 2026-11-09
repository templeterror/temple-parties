/**
 * Last-semester host champions — TUP-12 tonight hotfix.
 *
 * The real TUP-12 work is linking last-sem host rows to current host_codes.
 * Until that data connection exists, this allowlist paints a #1 chip on
 * matching host names (feed + the party page's host line) with no schema change.
 *
 * Empty LAST_SEMESTER_CHAMPION_HOSTS to turn the overlay off everywhere
 * (same kill switch as lib/sponsors.ts).
 */

/** Display names as they appear on party.host. Match is case-insensitive. */
export const LAST_SEMESTER_CHAMPION_HOSTS: readonly string[] = ['Latin Heat'];

export const LAST_SEM_RANKS_HREF = '/leaderboards?filter=by-hosts';

const CHAMPION_SET = new Set(
  LAST_SEMESTER_CHAMPION_HOSTS.map((name) => name.trim().toLowerCase()),
);

export function isLastSemesterChampion(host: string | null | undefined): boolean {
  if (!host) return false;
  return CHAMPION_SET.has(host.trim().toLowerCase());
}
