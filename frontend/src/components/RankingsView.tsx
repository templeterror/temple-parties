'use client';

/**
 * RankingsView — the Ranks tab: parties ranked by like percentage, or hosts
 * ranked by the Wilson-score leaderboard.
 *
 * One dropdown drives everything (Last Weekend / This Month / This Semester
 * / By Hosts — owner's call: a single familiar control beats stacked tabs).
 * The rows are cards in the v2 feed language; party cards link straight to
 * their party page, and rank numbers medal: #1 gold, #2 light purple,
 * #3 purple, the rest quiet.
 */

import { useState, useEffect, useMemo } from 'react';
import Header from './Header';
import RankingsDropdown, { RankingsFilter } from './RankingsDropdown';
import RankChampionCard from './RankChampionCard';
import RankingRow from './RankingRow';
import HostRankingRow from './HostRankingRow';
import HostRankingInfoModal from './HostRankingInfoModal';
import EmptyState from './EmptyState';
import { PartyRanking, HostRanking } from '@/lib/types';
import { getMonthRange, getSemesterRange, toISODate } from '@/utils/dateHelpers';
import { partiesApi, ratingsApi } from '@/services/api';

type PartyMode = { mode: 'parties'; params: { weekendOf?: string; weekendFrom?: string; weekendTo?: string } };
type HostsMode = { mode: 'hosts' };
type FetchSpec = PartyMode | HostsMode;

/** Previous Friday relative to a Friday ISO date (server weekend key − 7 days). */
function previousFridayISO(fridayISO: string): string {
  const d = new Date(`${fridayISO}T12:00:00`);
  d.setDate(d.getDate() - 7);
  return toISODate(d);
}

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
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
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

  const lastWeekendOf = weekendOverride
    ?? (currentWeekendOf ? previousFridayISO(currentWeekendOf) : null);

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

  // Push parties below rating threshold to the end
  const sortedPartyRankings = useMemo(() => {
    const rated = partyRankings.filter(p => p.ratingCount >= 5);
    const unrated = partyRankings.filter(p => p.ratingCount < 5);
    return [...rated, ...unrated];
  }, [partyRankings]);

  // Push ineligible hosts (<2 parties or <15 ratings) to the end, dimmed.
  const sortedHostRankings = useMemo(() => {
    const eligible = hostRankings.filter(h => h.isEligible);
    const ineligible = hostRankings.filter(h => !h.isEligible);
    return [...eligible, ...ineligible];
  }, [hostRankings]);

  const showHosts = fetchSpec?.mode === 'hosts';
  const hasRows = showHosts ? sortedHostRankings.length > 0 : sortedPartyRankings.length > 0;

  // The #1 party gets the hero treatment — but only a REAL #1 (meets the
  // rating threshold). An unrated period just renders the plain list.
  const champion = !showHosts && sortedPartyRankings[0]?.ratingCount >= 5
    ? sortedPartyRankings[0]
    : null;
  const restOfParties = champion ? sortedPartyRankings.slice(1) : sortedPartyRankings;
  const championPeriodLabel =
    selectedFilter === 'last-week' ? 'LAST WEEKEND'
    : selectedFilter === 'this-month' ? 'THIS MONTH'
    : 'THIS SEMESTER';

  return (
    <div className="pb-24 lg:pb-8">
      <Header title="Rankings" />

      <RankingsDropdown
        selectedFilter={selectedFilter}
        onFilterChange={setSelectedFilter}
        onOpenChange={setIsDropdownOpen}
        onInfoClick={selectedFilter === 'by-hosts' ? () => setInfoOpen(true) : undefined}
      />

      <div className={`max-w-xl mx-auto px-4 sm:px-6 transition-opacity duration-200 ${isDropdownOpen ? 'opacity-70' : 'opacity-100'}`}>
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-temple-purple"></div>
          </div>
        ) : !hasRows ? (
          <EmptyState
            message={showHosts ? 'No ranked hosts yet' : 'No ranked parties for this period'}
            leaderboardsHref={null}
          />
        ) : (
          <div className="animate-slide-up-fade">
            {showHosts ? (
              sortedHostRankings.map((host, index) => (
                <HostRankingRow
                  key={host.hostCode}
                  rank={index + 1}
                  host={host}
                  isBelowThreshold={!host.isEligible}
                />
              ))
            ) : (
              <>
                {champion && (
                  <RankChampionCard party={champion} periodLabel={championPeriodLabel} />
                )}
                {restOfParties.map((party, index) => (
                  <RankingRow
                    key={party.id}
                    rank={index + (champion ? 2 : 1)}
                    party={party}
                    isBelowThreshold={party.ratingCount < 5}
                  />
                ))}
              </>
            )}
          </div>
        )}
      </div>

      <HostRankingInfoModal isOpen={infoOpen} onClose={() => setInfoOpen(false)} />
    </div>
  );
}
