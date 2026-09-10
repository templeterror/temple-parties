import {
  pickFeaturedParty,
  isInsidePartyZone,
  zoomToFitInside,
  pinVariantFor,
  partyPhase,
  showHostChip,
  coverStat,
  LIVE_WINDOW_MS,
  PARTY_ZONE,
  PARTY_ZONE_BOUNDS,
  type FeaturedPartyInput,
} from '../utils/mapHelpers';
import type { PartyDay } from '../lib/types';

describe('pin rules', () => {
  it('gives verified hosts the ring pin and everyone else the purple disc', () => {
    expect(pinVariantFor({ isVerified: true })).toBe('ring');
    expect(pinVariantFor({ isVerified: false })).toBe('disc');
  });

  it('phases a party: upcoming before doors, live for 4h, over after', () => {
    const doors = new Date('2026-08-28T23:00:00');
    const at = (ms: number) => new Date(doors.getTime() + ms);
    expect(partyPhase(doors, at(-1))).toBe('upcoming');
    expect(partyPhase(doors, at(0))).toBe('live');
    expect(partyPhase(doors, at(LIVE_WINDOW_MS - 1))).toBe('live');
    expect(partyPhase(doors, at(LIVE_WINDOW_MS))).toBe('over');
  });

  it('only shows the host chip from zoom 16 up', () => {
    expect(showHostChip(15.9)).toBe(false);
    expect(showHostChip(16)).toBe(true);
    expect(showHostChip(17.4)).toBe(true);
  });

  it('shows the cover as FREE / $N / — only — never the host\'s prose', () => {
    expect(coverStat({ ticketPrice: '$5' })).toEqual({ value: '$5', label: 'COVER' });
    expect(coverStat({ ticketPrice: '$10 at the door' })).toEqual({ value: '$10', label: 'COVER' });
    expect(coverStat({ ticketPrice: 'donation' })).toEqual({ value: '—', label: 'COVER' });
    expect(coverStat({ ticketUrl: 'https://t.example/x' })).toEqual({ value: '—', label: 'TICKETS' });
    expect(coverStat({ ticketPrice: '$15+', ticketUrl: 'https://t.example/x' })).toEqual({ value: '$15', label: 'TICKETS' });
    expect(coverStat({})).toEqual({ value: 'FREE', label: 'COVER' });
  });
});

describe('party zone', () => {
  it('is a real box (north above south, east right of west)', () => {
    expect(PARTY_ZONE.north).toBeGreaterThan(PARTY_ZONE.south);
    expect(PARTY_ZONE.east).toBeGreaterThan(PARTY_ZONE.west);
  });

  it('exposes the Leaflet shape as [[south, west], [north, east]]', () => {
    expect(PARTY_ZONE_BOUNDS).toEqual([
      [PARTY_ZONE.south, PARTY_ZONE.west],
      [PARTY_ZONE.north, PARTY_ZONE.east],
    ]);
  });

  it('contains campus corners, Temple center, and Philly party spots', () => {
    expect(isInsidePartyZone(39.9904034, -75.1635189)).toBe(true); // 19th & York
    expect(isInsidePartyZone(39.987515, -75.1412)).toBe(true); // 5th & York
    expect(isInsidePartyZone(39.9725032, -75.1674231)).toBe(true); // 19th & Girard
    expect(isInsidePartyZone(39.9701465, -75.1450397)).toBe(true); // 5th & Girard
    expect(isInsidePartyZone(39.9812, -75.155)).toBe(true); // TEMPLE_CENTER
    expect(isInsidePartyZone(39.9526, -75.1652)).toBe(true); // City Hall
    expect(isInsidePartyZone(39.900833, -75.1675)).toBe(true); // Lincoln Financial
    expect(isInsidePartyZone(39.9705, -75.134)).toBe(true); // Fishtown-ish
    expect(isInsidePartyZone(39.9566, -75.1899)).toBe(true); // Drexel / UCity
  });

  it('rejects places outside Philadelphia', () => {
    expect(isInsidePartyZone(40.7128, -74.006)).toBe(false); // NYC
    expect(isInsidePartyZone(39.9812, -74.9)).toBe(false); // east of the city box
    expect(isInsidePartyZone(40.2, -75.155)).toBe(false); // north of Philly
    expect(isInsidePartyZone(39.85, -75.1675)).toBe(false); // south of the stadium box
  });
});

describe('zoomToFitInside', () => {
  it('keeps the zoom when the viewport already matches the box exactly', () => {
    expect(zoomToFitInside({ x: 400, y: 600 }, { x: 400, y: 600 }, 15)).toBe(15);
  });

  it('lets you zoom out one level when the screen is half the box each way', () => {
    expect(zoomToFitInside({ x: 200, y: 300 }, { x: 400, y: 600 }, 15)).toBe(14);
  });

  it('is driven by the tighter dimension, not the looser one', () => {
    // Phone: the screen is narrower than the box (could zoom out) but
    // taller than it (must zoom in). Height wins: 15 + log2(700/614).
    const zoom = zoomToFitInside({ x: 390, y: 700 }, { x: 609, y: 614 }, 15);
    expect(zoom).toBeCloseTo(15.19, 2);
    expect(zoom).toBeGreaterThan(15);
  });

  it('rounds up so the box is never a hair smaller than the screen', () => {
    expect(zoomToFitInside({ x: 100, y: 100 }, { x: 99.99, y: 99.99 }, 15)).toBe(15.01);
  });
});

const party = (
  id: string,
  day: PartyDay,
  goingCount: number | null,
): FeaturedPartyInput => ({ id, day, goingCount });

const top = (thursday: string | null, friday: string | null, saturday: string | null) => ({
  thursday,
  friday,
  saturday,
});

describe('pickFeaturedParty', () => {
  it('returns null when that night is empty', () => {
    expect(pickFeaturedParty([party('a', 'saturday', 10)], top(null, 'a', null), 'friday')).toBeNull();
  });

  it('prefers the headliner even when another party has more going', () => {
    const parties = [party('packed', 'friday', 40), party('headliner', 'friday', 2)];
    expect(pickFeaturedParty(parties, top(null, 'headliner', null), 'friday')?.id).toBe('headliner');
  });

  it('falls back to most-going when the headliner id is missing', () => {
    const parties = [party('a', 'friday', 3), party('b', 'friday', 12), party('c', 'friday', 8)];
    expect(pickFeaturedParty(parties, top(null, 'gone', null), 'friday')?.id).toBe('b');
  });

  it('sorts gated (null) counts last so dashes never beat a real number', () => {
    const parties = [party('gated', 'saturday', null), party('real', 'saturday', 1)];
    expect(pickFeaturedParty(parties, top(null, null, null), 'saturday')?.id).toBe('real');
  });

  it('picks the first party when every count is gated', () => {
    const parties = [party('first', 'friday', null), party('second', 'friday', null)];
    expect(pickFeaturedParty(parties, top(null, null, null), 'friday')?.id).toBe('first');
  });

  it('keeps the first party when going counts tie', () => {
    const parties = [party('first', 'saturday', 5), party('second', 'saturday', 5)];
    expect(pickFeaturedParty(parties, top(null, null, null), 'saturday')?.id).toBe('first');
  });

  it('picks the Thursday headliner the same way as Friday and Saturday', () => {
    const parties = [party('packed', 'thursday', 20), party('headliner', 'thursday', 1)];
    expect(pickFeaturedParty(parties, top('headliner', null, null), 'thursday')?.id).toBe('headliner');
  });
});
