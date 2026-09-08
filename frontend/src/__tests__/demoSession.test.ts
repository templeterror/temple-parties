import {
  DEMO_PARTIES,
  DEMO_SNAPSHOT,
  demoNowDate,
  findDemoParty,
  toDemoPartyRankings,
} from '@/data/demoSnapshot';
import {
  DEMO_SESSION_KEY,
  emptyDemoSession,
  loadDemoSession,
  overlayDemoParties,
  persistDemoSession,
  rateInSession,
  sanitizeDemoSession,
  toggleGoingInSession,
} from '@/lib/demoSession';
import { applyUserRating, voteCounts } from '@/utils/ratingHelpers';
import { isInsidePartyZone } from '@/utils/mapHelpers';
import { getDefaultDay } from '@/utils/dateHelpers';

describe('demo snapshot', () => {
  it('pins the clock to Friday night of the fixture weekend', () => {
    const now = demoNowDate();
    expect(DEMO_SNAPSHOT.weekendOf).toBe('2026-04-10');
    expect(getDefaultDay(now)).toBe('friday');
  });

  it('places every party inside the map lock', () => {
    for (const party of DEMO_PARTIES) {
      expect(isInsidePartyZone(party.latitude, party.longitude)).toBe(true);
      expect(party.address).toBeTruthy();
      expect(party.goingCount).not.toBeNull();
      expect(party.likePercentage).not.toBeNull();
      expect(party.posterImage).toMatch(/^\/demo\/posters\/.+\.jpg$/);
    }
  });

  it('looks up parties by slug, not a production UUID', () => {
    expect(findDemoParty('demo-fri-headliner')?.title).toMatch(/FREAKNIK/i);
    expect(findDemoParty('790c82f0-7a6b-4edb-ba41-95de642d5abc')).toBeUndefined();
  });
});

describe('applyUserRating', () => {
  it('adds a first up-vote and bumps the total', () => {
    const next = applyUserRating(50, 10, null, 1);
    const votes = voteCounts(next.likePercentage, next.ratingCount);
    expect(next.ratingCount).toBe(11);
    expect(votes?.likeCount).toBe(6);
  });

  it('switches an up-vote to a down-vote without changing the total', () => {
    const next = applyUserRating(100, 4, 1, 0);
    expect(next.ratingCount).toBe(4);
    expect(next.likePercentage).toBe(75);
  });

  it('is a no-op when the same thumb is tapped again', () => {
    expect(applyUserRating(80, 10, 1, 1)).toEqual({ likePercentage: 80, ratingCount: 10 });
  });
});

describe('demo session', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('increments going count on mark and decrements on unmark', () => {
    const id = 'demo-fri-headliner';
    const base = DEMO_PARTIES.find((p) => p.id === id)!;
    const marked = toggleGoingInSession(emptyDemoSession(), id);
    const overlayed = overlayDemoParties(DEMO_PARTIES, marked);
    expect(overlayed.find((p) => p.id === id)?.goingCount).toBe((base.goingCount ?? 0) + 1);

    const unmarked = toggleGoingInSession(marked, id);
    const restored = overlayDemoParties(DEMO_PARTIES, unmarked);
    expect(restored.find((p) => p.id === id)?.goingCount).toBe(base.goingCount);
  });

  it('updates like count after a rating', () => {
    const party = findDemoParty('demo-fri-headliner')!;
    const before = voteCounts(party.likePercentage, party.ratingCount);
    const next = rateInSession(emptyDemoSession(), party, 1);
    const overlayed = overlayDemoParties(DEMO_PARTIES, next).find((p) => p.id === party.id)!;
    expect(overlayed.ratingCount).toBe((party.ratingCount ?? 0) + 1);
    const after = voteCounts(overlayed.likePercentage, overlayed.ratingCount);
    expect(after?.likeCount).toBe((before?.likeCount ?? 0) + 1);
  });

  it('round-trips through sessionStorage', () => {
    const marked = toggleGoingInSession(emptyDemoSession(), 'demo-fri-headliner');
    persistDemoSession(marked);
    expect(sessionStorage.getItem(DEMO_SESSION_KEY)).toBeTruthy();
    const loaded = loadDemoSession();
    expect(loaded.goingIds).toEqual(['demo-fri-headliner']);
    expect(loaded.goingDelta['demo-fri-headliner']).toBe(1);
  });

  it('drops unknown party ids from persisted state', () => {
    const cleaned = sanitizeDemoSession({
      goingIds: ['demo-fri-headliner', 'real-uuid'],
      ratings: { 'demo-fri-headliner': 1, nope: 1 },
      goingDelta: { 'real-uuid': 99 },
      ratingOverlay: {},
    });
    expect(cleaned.goingIds).toEqual(['demo-fri-headliner']);
    expect(cleaned.ratings).toEqual({ 'demo-fri-headliner': 1 });
    expect(cleaned.goingDelta).toEqual({});
  });

  it('builds rankings from overlayed parties', () => {
    const rankings = toDemoPartyRankings(DEMO_PARTIES, {});
    expect(rankings[0].ratingCount).toBeGreaterThanOrEqual(5);
    expect(rankings[0].id).toMatch(/^demo-/);
  });
});
