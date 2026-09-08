import { DEMO_PARTIES, DEMO_PARTY_IDS, topPartyIdsByDay } from '@/data/demoSnapshot';
import type { Party } from '@/lib/types';
import { applyUserRating } from '@/utils/ratingHelpers';

export const DEMO_SESSION_KEY = 'demo:session';

export interface DemoSessionState {
  goingIds: string[];
  ratings: Record<string, number>;
  goingDelta: Record<string, number>;
  ratingOverlay: Record<string, { likePercentage: number; ratingCount: number }>;
}

export function emptyDemoSession(): DemoSessionState {
  return { goingIds: [], ratings: {}, goingDelta: {}, ratingOverlay: {} };
}

function knownId(id: string): boolean {
  return DEMO_PARTY_IDS.has(id);
}

export function sanitizeDemoSession(raw: unknown): DemoSessionState {
  const empty = emptyDemoSession();
  if (!raw || typeof raw !== 'object') return empty;
  const data = raw as Partial<DemoSessionState>;

  const goingIds = Array.isArray(data.goingIds)
    ? data.goingIds.filter((id): id is string => typeof id === 'string' && knownId(id))
    : [];

  const ratings: Record<string, number> = {};
  if (data.ratings && typeof data.ratings === 'object') {
    for (const [id, value] of Object.entries(data.ratings)) {
      if (knownId(id) && (value === 0 || value === 1)) ratings[id] = value;
    }
  }

  const goingDelta: Record<string, number> = {};
  if (data.goingDelta && typeof data.goingDelta === 'object') {
    for (const [id, value] of Object.entries(data.goingDelta)) {
      if (knownId(id) && typeof value === 'number' && Number.isFinite(value)) {
        goingDelta[id] = value;
      }
    }
  }

  const ratingOverlay: Record<string, { likePercentage: number; ratingCount: number }> = {};
  if (data.ratingOverlay && typeof data.ratingOverlay === 'object') {
    for (const [id, value] of Object.entries(data.ratingOverlay)) {
      if (
        knownId(id) &&
        value &&
        typeof value === 'object' &&
        typeof value.likePercentage === 'number' &&
        typeof value.ratingCount === 'number'
      ) {
        ratingOverlay[id] = {
          likePercentage: value.likePercentage,
          ratingCount: value.ratingCount,
        };
      }
    }
  }

  return { goingIds, ratings, goingDelta, ratingOverlay };
}

export function loadDemoSession(): DemoSessionState {
  if (typeof window === 'undefined') return emptyDemoSession();
  try {
    const raw = sessionStorage.getItem(DEMO_SESSION_KEY);
    return raw ? sanitizeDemoSession(JSON.parse(raw)) : emptyDemoSession();
  } catch {
    return emptyDemoSession();
  }
}

export function persistDemoSession(state: DemoSessionState): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(state));
  } catch {
    // Private mode / quota — keep the in-memory session.
  }
}

export function overlayDemoParties(
  parties: Party[] = DEMO_PARTIES,
  session: DemoSessionState,
): Party[] {
  const withCounts = parties.map((p) => {
    const overlay = session.ratingOverlay[p.id];
    return {
      ...p,
      goingCount: (p.goingCount ?? 0) + (session.goingDelta[p.id] ?? 0),
      likePercentage: overlay?.likePercentage ?? p.likePercentage,
      ratingCount: overlay?.ratingCount ?? p.ratingCount,
    };
  });
  const tops = topPartyIdsByDay(withCounts);
  return withCounts.map((p) => ({ ...p, isHeadliner: tops[p.day] === p.id }));
}

export function toggleGoingInSession(session: DemoSessionState, partyId: string): DemoSessionState {
  if (!knownId(partyId)) return session;
  const wasGoing = session.goingIds.includes(partyId);
  const goingIds = wasGoing
    ? session.goingIds.filter((id) => id !== partyId)
    : [...session.goingIds, partyId];
  const goingDelta = {
    ...session.goingDelta,
    [partyId]: (session.goingDelta[partyId] ?? 0) + (wasGoing ? -1 : 1),
  };
  return { ...session, goingIds, goingDelta };
}

export function rateInSession(
  session: DemoSessionState,
  party: Party,
  rating: number,
): DemoSessionState {
  if (!knownId(party.id) || (rating !== 0 && rating !== 1)) return session;
  const previous = session.ratings[party.id];
  const baseline = session.ratingOverlay[party.id] ?? {
    likePercentage: party.likePercentage ?? 0,
    ratingCount: party.ratingCount ?? 0,
  };
  const next = applyUserRating(baseline.likePercentage, baseline.ratingCount, previous, rating);
  return {
    ...session,
    ratings: { ...session.ratings, [party.id]: rating },
    ratingOverlay: { ...session.ratingOverlay, [party.id]: next },
  };
}
