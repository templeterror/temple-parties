import type { Party } from '@/lib/types';
import { BELL_TOWER } from '@/utils/partyDeck';
import {
  buildPartyPage,
  ratingMode,
  shortDate,
  ticketSiteHost,
  voteResultLine,
  whenTime,
} from '@/utils/partyPage';

/** Demo clock: Fri 2026-04-10 11:30 PM ET (data/demoSnapshot.ts). */
const FRI_NIGHT = new Date('2026-04-10T23:30:00-04:00');
/** Fri 2026-04-10 6 PM ET — Friday's parties haven't opened yet. */
const FRI_EVENING = new Date('2026-04-10T18:00:00-04:00');
/** Tue 2026-04-14 noon ET — the weekend is over. */
const TUESDAY = new Date('2026-04-14T12:00:00-04:00');

function party(overrides: Partial<Party> = {}): Party {
  return {
    id: 'p',
    title: 'Party',
    host: 'Host',
    pinLabel: 'H',
    category: 'House Party',
    day: 'friday',
    date: '2026-04-10',
    doorsOpen: '10 PM',
    doorsClose: '2 AM',
    address: '1535 N Carlisle St, Philadelphia, PA 19121',
    latitude: BELL_TOWER.lat,
    longitude: BELL_TOWER.lng,
    goingCount: 186,
    likePercentage: 90,
    ratingCount: 64,
    isVerified: false,
    ratingOpen: true,
    ratingLocked: false,
    ...overrides,
  };
}

const page = (p: Partial<Party>, now: Date = FRI_NIGHT, isTop = false) =>
  buildPartyPage({ party: party(p), now, isTop });

describe('phase-dependent When time', () => {
  it('upcoming: the facts line has the doors, so the row adds only "until <close>"', () => {
    const m = page({ ratingOpen: false }, FRI_EVENING);
    expect(m.phase).toBe('upcoming');
    expect(m.doorLabel).toBe('Doors 10 PM');
    expect(m.whenTime).toBe('until 2 AM');
  });

  it('upcoming with no close time: date only', () => {
    const m = page({ doorsClose: null, ratingOpen: false }, FRI_EVENING);
    expect(m.whenDate).toBe('Fri, Apr 10');
    expect(m.whenTime).toBeNull();
  });

  it('live: the facts line says "Live now", so the row carries the span', () => {
    const m = page({});
    expect(m.phase).toBe('live');
    expect(m.doorLabel).toBe('Live now');
    expect(m.whenTime).toBe('10 PM–2 AM');
  });

  it('ended: "Ended" in the facts, the span (or bare doors) in the row', () => {
    expect(page({}, TUESDAY).whenTime).toBe('10 PM–2 AM');
    const bare = page({ doorsClose: null }, TUESDAY);
    expect(bare.phase).toBe('ended');
    expect(bare.doorLabel).toBe('Ended');
    expect(bare.whenTime).toBe('10 PM');
  });

  it('shortDate accepts a bare date or an ISO timestamp', () => {
    expect(shortDate('2026-04-11')).toBe('Sat, Apr 11');
    expect(shortDate('2026-04-11T00:00:00')).toBe('Sat, Apr 11');
    expect(shortDate('nonsense')).toBe('nonsense');
  });

  it('whenTime is exported for callers that already know the phase', () => {
    expect(whenTime({ doorsOpen: '11 PM', doorsClose: '3 AM' }, 'upcoming')).toBe('until 3 AM');
  });
});

describe('no-repeat rule (facts line vs list)', () => {
  it('upcoming: the doors time appears once (facts line), never in the When row', () => {
    const m = page({ ratingOpen: false }, FRI_EVENING);
    expect(m.doorLabel).toContain('10 PM');
    expect(m.whenTime ?? '').not.toContain('10 PM');
  });

  it('the price lives on the facts line; the ticket row names the site, not the price', () => {
    const m = page({ ticketPrice: '$15', ticketUrl: 'https://posh.vip/e/x?ref=tuparty' });
    expect(m.priceLabel).toBe('$15');
    expect(m.priceInline).toBe(true);
    expect(m.ticketLinkLabel).toBe('Tickets on posh.vip');
    expect(m.ticketLinkLabel).not.toContain('$15');
  });

  it('long host price text gets its own facts line instead of riding inline', () => {
    expect(page({ ticketPrice: '$15 presale / $20 door' }).priceInline).toBe(false);
    expect(page({}).priceLabel).toBe('Free');
    expect(page({}).priceInline).toBe(true);
  });

  it('the going count is only in the list (one label), and past nights say "went"', () => {
    expect(page({}).goingLabel).toBe('186');
    expect(page({}).goingWord).toBe('going');
    expect(page({}, TUESDAY).goingWord).toBe('went');
    expect(page({ goingCount: 1204 }).goingLabel).toBe('1.2k');
  });

  it('splits the address into street + the rest', () => {
    const m = page({});
    expect(m.addressLine).toBe('1535 N Carlisle St');
    expect(m.addressRest).toBe('Philadelphia, PA 19121');
    expect(page({ address: '1535 N Carlisle St' }).addressRest).toBeNull();
  });
});

describe('ticket site host extraction', () => {
  it('reads the hostname and drops www.', () => {
    expect(ticketSiteHost('https://posh.vip/e/latin-heat?ref=tuparty')).toBe('posh.vip');
    expect(ticketSiteHost('https://www.eventbrite.com/e/123')).toBe('eventbrite.com');
  });

  it('is null for a missing or unparseable link', () => {
    expect(ticketSiteHost(null)).toBeNull();
    expect(ticketSiteHost('')).toBeNull();
    expect(ticketSiteHost('not a url')).toBeNull();
  });

  it('falls back to "Tickets online" when the host cannot be read; null when not ticketed', () => {
    expect(page({ ticketUrl: 'not a url' }).ticketLinkLabel).toBe('Tickets online');
    expect(page({}).ticketLinkLabel).toBeNull();
    expect(page({}).ticketed).toBe(false);
  });
});

describe('logged-out nulls (soft gate)', () => {
  const m = page({ address: null, goingCount: null, likePercentage: null, ratingCount: null, promoCode: null });

  it('gates the address row and keeps nulls null', () => {
    expect(m.gated).toBe(true);
    expect(m.addressLine).toBeNull();
    expect(m.addressRest).toBeNull();
  });

  it('shows a dash for going, never a fake 0', () => {
    expect(m.goingLabel).toBe('—');
    expect(m.goingGated).toBe(true);
  });

  it('has no vote result line', () => {
    expect(m.voteResult).toBeNull();
    expect(voteResultLine(null, null)).toBeNull();
  });

  it('a real zero is not a gate', () => {
    expect(page({ goingCount: 0 }).goingLabel).toBe('0');
    expect(page({ goingCount: 0 }).goingGated).toBe(false);
    expect(voteResultLine(0, 0)).toBe('No votes yet');
    expect(voteResultLine(100, 1)).toBe('100% liked · 1 vote');
  });
});

describe('eyebrow', () => {
  it('hides the Other category', () => {
    expect(page({ category: 'Other' }).category).toBeNull();
    expect(page({ category: ' other ' }).category).toBeNull();
    expect(page({ category: 'Frat Party' }).category).toBe('Frat Party');
  });

  it('#1 tonight on a live top party', () => {
    expect(page({}, FRI_NIGHT, true).topLabel).toBe('#1 tonight');
  });

  it('#1 <day> on an upcoming top party seen from another night', () => {
    const sat = page({ day: 'saturday', date: '2026-04-11', doorsOpen: '11 PM', ratingOpen: false }, FRI_NIGHT, true);
    expect(sat.phase).toBe('upcoming');
    expect(sat.topLabel).toBe('#1 Saturday');
  });

  it('never on an ended party, and never when not the top party', () => {
    expect(page({}, TUESDAY, true).topLabel).toBeNull();
    expect(page({}, FRI_NIGHT, false).topLabel).toBeNull();
  });
});

describe('host line', () => {
  it('shows liked % · parties only with hostStats', () => {
    expect(page({}).hostStatsLine).toBeNull();
    expect(
      page({ hostStats: { displayName: 'Ego', partiesHosted: 9, avgLikePercentage: 89.6, logoUrl: null } }).hostStatsLine,
    ).toBe('90% liked · 9 parties');
    expect(
      page({ hostStats: { displayName: 'Ego', partiesHosted: 1, avgLikePercentage: 70, logoUrl: null } }).hostStatsLine,
    ).toBe('70% liked · 1 party');
  });
});

describe('rating mode + the action bar', () => {
  it('follows the server window; upcoming is always "before"', () => {
    expect(ratingMode('inactive', 'upcoming')).toBe('before');
    expect(ratingMode('open', 'upcoming')).toBe('before');
    expect(ratingMode('open', 'live')).toBe('open');
    expect(ratingMode('locked', 'ended')).toBe('closed');
  });

  it('an ended party still takes votes until the server locks them (Monday 11:59 PM)', () => {
    const m = page({}, new Date('2026-04-11T10:00:00-04:00'));
    expect(m.phase).toBe('ended');
    expect(m.ratingMode).toBe('open');
    expect(m.shareOnly).toBe(false);
  });

  it('share-only once the party is over and voting has closed', () => {
    const m = page({ ratingOpen: false, ratingLocked: true }, TUESDAY);
    expect(m.ratingMode).toBe('closed');
    expect(m.shareOnly).toBe(true);
  });
});
