'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import {
  DEMO_HOST_RANKINGS,
  DEMO_PARTIES,
  DEMO_SNAPSHOT,
  demoDayOfMonth,
  demoNowDate,
  findDemoParty,
  toDemoPartyRankings,
  topPartyIdsByDay,
} from '@/data/demoSnapshot';
import {
  loadDemoSession,
  overlayDemoParties,
  persistDemoSession,
  rateInSession,
  toggleGoingInSession,
  type DemoSessionState,
} from '@/lib/demoSession';
import type { HostRanking, Party, PartyDay, PartyRanking } from '@/lib/types';

interface DemoSessionContextValue {
  weekendOf: string;
  thursdayDate: string;
  fridayDate: string;
  saturdayDate: string;
  demoNow: Date;
  parties: Party[];
  goingParties: string[];
  isGoing: (partyId: string) => boolean;
  toggleGoing: (partyId: string) => void;
  ensureGoing: (partyId: string) => void;
  getUserRating: (partyId: string) => number | null;
  submitRating: (partyId: string, rating: number) => void;
  partyById: (id: string) => Party | undefined;
  partyRankings: PartyRanking[];
  hostRankings: HostRanking[];
  topPartyIds: Record<PartyDay, string | null>;
  dayCounts: Record<PartyDay, number>;
}

const DemoSessionContext = createContext<DemoSessionContextValue | null>(null);

export function DemoSessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<DemoSessionState>(() => loadDemoSession());
  const demoNow = useMemo(() => demoNowDate(), []);

  const commit = useCallback((next: DemoSessionState) => {
    setSession(next);
    persistDemoSession(next);
  }, []);

  const parties = useMemo(() => overlayDemoParties(DEMO_PARTIES, session), [session]);

  const toggleGoing = useCallback(
    (partyId: string) => {
      commit(toggleGoingInSession(session, partyId));
    },
    [commit, session],
  );

  const ensureGoing = useCallback(
    (partyId: string) => {
      if (session.goingIds.includes(partyId)) return;
      commit(toggleGoingInSession(session, partyId));
    },
    [commit, session],
  );

  const submitRating = useCallback(
    (partyId: string, rating: number) => {
      const party = findDemoParty(partyId);
      if (!party) return;
      commit(rateInSession(session, party, rating));
    },
    [commit, session],
  );

  const isGoing = useCallback(
    (partyId: string) => session.goingIds.includes(partyId),
    [session.goingIds],
  );

  const getUserRating = useCallback(
    (partyId: string) => (partyId in session.ratings ? session.ratings[partyId] : null),
    [session.ratings],
  );

  const partyById = useCallback(
    (id: string) => parties.find((p) => p.id === id),
    [parties],
  );

  const partyRankings = useMemo(
    () => toDemoPartyRankings(parties, session.ratings),
    [parties, session.ratings],
  );

  const topPartyIds = useMemo(() => topPartyIdsByDay(parties), [parties]);

  const dayCounts = useMemo(() => {
    const counts = { thursday: 0, friday: 0, saturday: 0 };
    for (const p of parties) {
      if (p.day in counts) counts[p.day] += 1;
    }
    return counts;
  }, [parties]);

  const value = useMemo<DemoSessionContextValue>(
    () => ({
      weekendOf: DEMO_SNAPSHOT.weekendOf,
      thursdayDate: demoDayOfMonth(DEMO_SNAPSHOT.thursdayDate),
      fridayDate: demoDayOfMonth(DEMO_SNAPSHOT.fridayDate),
      saturdayDate: demoDayOfMonth(DEMO_SNAPSHOT.saturdayDate),
      demoNow,
      parties,
      goingParties: session.goingIds,
      isGoing,
      toggleGoing,
      ensureGoing,
      getUserRating,
      submitRating,
      partyById,
      partyRankings,
      hostRankings: DEMO_HOST_RANKINGS,
      topPartyIds,
      dayCounts,
    }),
    [
      demoNow,
      parties,
      session.goingIds,
      isGoing,
      toggleGoing,
      ensureGoing,
      getUserRating,
      submitRating,
      partyById,
      partyRankings,
      topPartyIds,
      dayCounts,
    ],
  );

  return <DemoSessionContext.Provider value={value}>{children}</DemoSessionContext.Provider>;
}

export function useDemoSession(): DemoSessionContextValue {
  const ctx = useContext(DemoSessionContext);
  if (!ctx) {
    throw new Error('useDemoSession must be used within DemoSessionProvider');
  }
  return ctx;
}

export function useDemoParties(selectedDay: PartyDay) {
  const session = useDemoSession();
  const filteredParties = useMemo(
    () =>
      session.parties
        .filter((p) => p.day === selectedDay)
        .sort((a, b) => (b.goingCount ?? 0) - (a.goingCount ?? 0)),
    [session.parties, selectedDay],
  );
  const topPartyId = filteredParties[0]?.id ?? null;
  return { ...session, filteredParties, topPartyId };
}
