'use client';

/**
 * RankingsView — the Ranks tab (/leaderboards, /demo/leaderboards): parties
 * ranked by like percentage for a period, or hosts ranked by the Wilson /
 * Bayesian leaderboard. Spec: DESIGN.md decision log, 2026-11-09
 * "Ranks → Podium"; pieces in components/ranks/, rules in utils/ranks.ts.
 *
 * Layout: one header row — the page title "Ranks" (the Dock's name for
 * this place; it replaces the old mobile `<Header title="Rankings" />`, so
 * there is exactly one title), the `How host ranking works` info button in
 * by-hosts, and the ONE period menu. Then the top three on a podium, #4+
 * as bare hairline rows, and anything under the floor in its own labelled
 * group. Loading = the podium/list skeleton; empty = the ghost podium + a
 * way out.
 *
 * Data (unchanged from the card version):
 *  - live: `ratingsApi.getRankings` per period / `getHostRankings`;
 *    "last weekend" waits for GET /parties' weekend key and resolves the
 *    most recently COMPLETED weekend (getLastCompletedWeekendFridayISO).
 *  - `weekendOverride` pins last-weekend to one Friday.
 *  - `snapshotParties` / `snapshotHosts` (the /demo sandbox) skip the APIs
 *    entirely; every party period shows the same frozen list.
 *
 * Analytics: `ranks_period_changed { period, source }` when the period
 * changes from the menu or an empty state's button.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import HostRankingInfoModal from './HostRankingInfoModal';
import RanksPodium, { RanksPodiumHostStep, RanksPodiumPartyStep } from './ranks/RanksPodium';
import { RanksHostRow, RanksPartyRow } from './ranks/RanksRow';
import { RanksList, RanksListItem, RanksUnrankedGroup } from './ranks/RanksList';
import { RanksEmpty, RanksNothingRanked } from './ranks/RanksEmpty';
import RanksPeriodMenu from './ranks/RanksPeriodMenu';
import RanksSkeleton from './ranks/RanksSkeleton';
import { DECK_FOCUS_RING } from './feed/RankStrip';
import { PartyRanking, HostRanking } from '@/lib/types';
import { getMonthRange, getSemesterRange, getLastCompletedWeekendFridayISO } from '@/utils/dateHelpers';
import { partiesApi, ratingsApi } from '@/services/api';
import { trackEvent } from '@/utils/analytics';
import {
  HOST_MIN_PARTIES,
  HOST_MIN_VOTES,
  PERIOD_LABELS,
  RANK_THRESHOLD,
  emptyStateNextFilter,
  podiumOrder,
  splitHostRankings,
  splitPartyRankings,
  type RankingsFilter,
} from '@/utils/ranks';

type PartyMode = { mode: 'parties'; params: { weekendOf?: string; weekendFrom?: string; weekendTo?: string } };
type HostsMode = { mode: 'hosts' };
type FetchSpec = PartyMode | HostsMode;

interface RankingsViewProps {
  // When set, RankingsView pins the parties leaderboard to this single
  // weekend on load. Used by /demo for a frozen snapshot.
  weekendOverride?: string;
  /** Deep-link from /leaderboards?filter=by-hosts (TUP-12 hotfix). */
  initialFilter?: RankingsFilter;
  /** When set, skip live APIs and show this frozen list (demo sandbox). */
  snapshotParties?: PartyRanking[];
  snapshotHosts?: HostRanking[];
}

export default function RankingsView({ weekendOverride, initialFilter, snapshotParties, snapshotHosts }: RankingsViewProps = {}) {
  const isSnapshot = snapshotParties != null;
  const [selectedFilter, setSelectedFilter] = useState<RankingsFilter>(
    weekendOverride || isSnapshot ? 'last-week' : (initialFilter ?? 'this-semester'),
  );
  const [fetchedPartyRankings, setFetchedPartyRankings] = useState<PartyRanking[]>([]);
  const [fetchedHostRankings, setFetchedHostRankings] = useState<HostRanking[]>([]);
  const [isLoading, setIsLoading] = useState(!isSnapshot);
  const [infoOpen, setInfoOpen] = useState(false);
  const infoButtonRef = useRef<HTMLButtonElement>(null);
  // Authoritative current weekend from GET /parties (fixes §8.11 mislabel).
  const [currentWeekendOf, setCurrentWeekendOf] = useState<string | null>(null);

  useEffect(() => {
    if (weekendOverride || isSnapshot) return;
    let cancelled = false;
    partiesApi.getParties().then((data) => {
      if (!cancelled) setCurrentWeekendOf(data.weekendOf);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [weekendOverride, isSnapshot]);

  // "Last weekend" = the most recently COMPLETED weekend per the 6 AM
  // rollover, which is not always the server key minus 7 days — the backend
  // already rolls Sat/Sun/Mon back to the past Friday. See the helper.
  const lastWeekendOf = weekendOverride
    ?? (currentWeekendOf ? getLastCompletedWeekendFridayISO(currentWeekendOf) : null);

  const fetchSpec: FetchSpec | null = useMemo(() => {
    switch (selectedFilter) {
      case 'last-week':
        if (!lastWeekendOf) return null;
        return { mode: 'parties', params: { weekendOf: lastWeekendOf } };
      case 'this-month': {
        const { from, to } = getMonthRange();
        return { mode: 'parties', params: { weekendFrom: from, weekendTo: to } };
      }
      case 'this-semester': {
        const { from, to } = getSemesterRange();
        return { mode: 'parties', params: { weekendFrom: from, weekendTo: to } };
      }
      case 'by-hosts':
        return { mode: 'hosts' };
    }
  }, [selectedFilter, lastWeekendOf]);

  useEffect(() => {
    if (isSnapshot) return;
    if (!fetchSpec) return;
    let cancelled = false;

    const fetchRankings = async () => {
      setIsLoading(true);
      try {
        if (fetchSpec.mode === 'parties') {
          const data = await ratingsApi.getRankings(fetchSpec.params);
          if (!cancelled) setFetchedPartyRankings(data);
        } else {
          const data = await ratingsApi.getHostRankings();
          if (!cancelled) setFetchedHostRankings(data);
        }
      } catch (error) {
        console.error('Failed to fetch rankings:', error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchRankings();
    return () => { cancelled = true; };
  }, [fetchSpec, isSnapshot]);

  const partyRankings = snapshotParties ?? fetchedPartyRankings;
  const hostRankings = snapshotHosts ?? fetchedHostRankings;
  const parties = useMemo(() => splitPartyRankings(partyRankings), [partyRankings]);
  const hosts = useMemo(() => splitHostRankings(hostRankings), [hostRankings]);

  const showHosts = selectedFilter === 'by-hosts';

  const changePeriod = (period: RankingsFilter, source: 'menu' | 'empty_state') => {
    setSelectedFilter(period);
    trackEvent('ranks_period_changed', { period, source });
  };

  // ModalWrapper doesn't move focus in or back out; do both from here
  // (emil-touch-and-accessibility #7).
  useEffect(() => {
    if (!infoOpen) return;
    const raf = requestAnimationFrame(() => {
      document.querySelector<HTMLElement>('[data-testid="modal-backdrop"] button')?.focus();
    });
    return () => cancelAnimationFrame(raf);
  }, [infoOpen]);

  const closeInfo = () => {
    setInfoOpen(false);
    infoButtonRef.current?.focus();
  };

  return (
    <div className="ranks mx-auto w-full max-w-[600px] px-4 pb-[var(--dock-clearance)] font-montserrat text-white lg:px-6 lg:pb-8">
      {/* The page's only title. Mobile clears the notch like the slim
          Header (safe area, 12px floor); desktop sits under the fixed bar. */}
      <header className="flex items-center gap-1 pb-3 pt-[max(env(safe-area-inset-top),12px)] lg:pt-10">
        <h1 className="flex-1 text-[26px] font-bold leading-8 tracking-[-0.01em]">Ranks</h1>
        {showHosts && (
          <button
            ref={infoButtonRef}
            type="button"
            aria-label="How host ranking works"
            onClick={() => setInfoOpen(true)}
            className={`ranks__press flex size-11 shrink-0 items-center justify-center rounded-full text-temple-muted hover:text-white ${DECK_FOCUS_RING}`}
          >
            <InfoIcon />
          </button>
        )}
        <RanksPeriodMenu value={selectedFilter} onValueChange={(p) => changePeriod(p, 'menu')} />
      </header>

      <div aria-busy={isLoading || undefined}>
        {isLoading ? (
          <RanksSkeleton />
        ) : showHosts ? (
          <HostsRanks ranked={hosts.ranked} unranked={hosts.unranked} onPeriodChange={(p) => changePeriod(p, 'empty_state')} />
        ) : (
          <PartiesRanks
            ranked={parties.ranked}
            unranked={parties.unranked}
            period={selectedFilter}
            onPeriodChange={(p) => changePeriod(p, 'empty_state')}
          />
        )}
      </div>

      <HostRankingInfoModal isOpen={infoOpen} onClose={closeInfo} />
    </div>
  );
}

// ─── Parties ─────────────────────────────────────────────────────────────────

function PartiesRanks({
  ranked,
  unranked,
  period,
  onPeriodChange,
}: {
  ranked: PartyRanking[];
  unranked: PartyRanking[];
  period: RankingsFilter;
  onPeriodChange: (p: RankingsFilter) => void;
}) {
  const label = PERIOD_LABELS[period].sentence;

  if (ranked.length === 0 && unranked.length === 0) {
    const next = emptyStateNextFilter(period);
    return (
      <RanksEmpty
        title={`No votes yet for ${label}.`}
        description="Voting opens when doors do."
        actionLabel={next === 'by-hosts' ? 'See host ranks' : `See ${PERIOD_LABELS[next].sentence}`}
        onAction={() => onPeriodChange(next)}
      />
    );
  }

  const top = ranked.slice(0, 3);
  const rest = ranked.slice(3);
  const eyebrow = `#1 ${label}`;

  return (
    <>
      {top.length > 0 ? (
        // Keyed by period so the steps rise again on every switch.
        <RanksPodium key={period} count={top.length} aria-label={`Top ${top.length}, ${label}`} className="mt-4">
          {podiumOrder(top).map((party) => (
            <RanksPodiumPartyStep key={party.id} party={party} rank={top.indexOf(party) + 1} eyebrow={eyebrow} />
          ))}
        </RanksPodium>
      ) : (
        <RanksNothingRanked>{`Nothing has ${RANK_THRESHOLD} votes yet for ${label}.`}</RanksNothingRanked>
      )}

      {rest.length > 0 && (
        <RanksList aria-label={`Ranks 4 to ${ranked.length}`}>
          {rest.map((party, i) => (
            <RanksListItem key={party.id}>
              <RanksPartyRow party={party} rank={i + 4} />
            </RanksListItem>
          ))}
        </RanksList>
      )}

      {unranked.length > 0 && (
        <RanksUnrankedGroup title="Not enough votes yet" note={`Needs ${RANK_THRESHOLD} votes to rank.`}>
          {unranked.map((party) => (
            <RanksListItem key={party.id}>
              <RanksPartyRow party={party} rank={null} />
            </RanksListItem>
          ))}
        </RanksUnrankedGroup>
      )}
    </>
  );
}

// ─── Hosts ───────────────────────────────────────────────────────────────────

function HostsRanks({
  ranked,
  unranked,
  onPeriodChange,
}: {
  ranked: HostRanking[];
  unranked: HostRanking[];
  onPeriodChange: (p: RankingsFilter) => void;
}) {
  const rule = `${HOST_MIN_PARTIES} parties and ${HOST_MIN_VOTES} votes`;

  if (ranked.length === 0 && unranked.length === 0) {
    const next = emptyStateNextFilter('by-hosts');
    return (
      <RanksEmpty
        title="No hosts ranked yet."
        description={`A host ranks after ${rule}.`}
        actionLabel={`See ${PERIOD_LABELS[next].sentence}`}
        onAction={() => onPeriodChange(next)}
      />
    );
  }

  const top = ranked.slice(0, 3);
  const rest = ranked.slice(3);

  return (
    <>
      {top.length > 0 ? (
        <RanksPodium key="by-hosts" count={top.length} aria-label={`Top ${top.length} hosts`} className="mt-4">
          {podiumOrder(top).map((host) => (
            <RanksPodiumHostStep key={host.hostCode} host={host} rank={top.indexOf(host) + 1} />
          ))}
        </RanksPodium>
      ) : (
        <RanksNothingRanked>{`No host has ${rule} yet.`}</RanksNothingRanked>
      )}

      {rest.length > 0 && (
        <RanksList aria-label={`Ranks 4 to ${ranked.length}`}>
          {rest.map((host, i) => (
            <RanksListItem key={host.hostCode}>
              <RanksHostRow host={host} rank={i + 4} />
            </RanksListItem>
          ))}
        </RanksList>
      )}

      {unranked.length > 0 && (
        <RanksUnrankedGroup title="Not ranked yet" note={`Needs ${rule}.`}>
          {unranked.map((host) => (
            <RanksListItem key={host.hostCode}>
              <RanksHostRow host={host} rank={null} />
            </RanksListItem>
          ))}
        </RanksUnrankedGroup>
      )}
    </>
  );
}

function InfoIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5" strokeLinecap="round" />
      <circle cx="12" cy="7.75" r="0.6" fill="currentColor" />
    </svg>
  );
}
