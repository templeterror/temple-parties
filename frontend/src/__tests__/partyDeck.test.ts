import type { Party } from '@/lib/types';
import {
  BELL_TOWER,
  buildDeckRows,
  formatGoing,
  meaningfulCategory,
  nightOf,
  nightPhase,
  partyWindow,
  phaseAt,
  priceLabels,
  rankParties,
  walkMinutesFromBellTower,
} from '@/utils/partyDeck';

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
    address: '1 N Broad St',
    latitude: BELL_TOWER.lat,
    longitude: BELL_TOWER.lng,
    goingCount: 0,
    likePercentage: 0,
    ratingCount: 0,
    isVerified: false,
    ...overrides,
  };
}

const ids = (list: { id: string }[]) => list.map((p) => p.id);

describe('rankParties', () => {
  it('sorts by going count, high to low', () => {
    const list = [party({ id: 'a', goingCount: 5 }), party({ id: 'b', goingCount: 40 }), party({ id: 'c', goingCount: 12 })];
    expect(ids(rankParties(list))).toEqual(['b', 'c', 'a']);
  });

  it('keeps the server order for ties', () => {
    const list = [party({ id: 'a', goingCount: 10 }), party({ id: 'b', goingCount: 30 }), party({ id: 'c', goingCount: 10 })];
    expect(ids(rankParties(list))).toEqual(['b', 'a', 'c']);
  });

  it('keeps the server order when counts are soft-gated (logged out)', () => {
    const list = [party({ id: 'x', goingCount: null }), party({ id: 'y', goingCount: null }), party({ id: 'z', goingCount: null })];
    expect(ids(rankParties(list))).toEqual(['x', 'y', 'z']);
  });

  it('puts a stray null after real counts', () => {
    const list = [party({ id: 'a', goingCount: null }), party({ id: 'b', goingCount: 1 })];
    expect(ids(rankParties(list))).toEqual(['b', 'a']);
  });

  it('moves a party up when your RSVP (in the overlaid count) breaks a tie', () => {
    const before = [party({ id: 'a', goingCount: 10 }), party({ id: 'b', goingCount: 10 })];
    expect(ids(rankParties(before))).toEqual(['a', 'b']);
    // useGoingStatus / the demo session hand back b's count with your +1.
    const after = [party({ id: 'a', goingCount: 10 }), party({ id: 'b', goingCount: 11 })];
    expect(ids(rankParties(after))).toEqual(['b', 'a']);
  });

  it('does not mutate its input', () => {
    const list = [party({ id: 'a', goingCount: 1 }), party({ id: 'b', goingCount: 2 })];
    rankParties(list);
    expect(ids(list)).toEqual(['a', 'b']);
  });
});

describe('buildDeckRows', () => {
  it('ranks 1…N, flags the top party and reads isGoing', () => {
    const rows = buildDeckRows(
      [party({ id: 'a', goingCount: 3 }), party({ id: 'b', goingCount: 9 })],
      { now: new Date('2026-04-10T20:00:00-04:00'), isGoing: (id) => id === 'a' },
    );
    expect(rows.map((r) => [r.id, r.rank, r.isTop, r.isGoing])).toEqual([
      ['b', 1, true, false],
      ['a', 2, false, true],
    ]);
  });

  it('keeps soft-gated counts null and hides % liked without hostStats', () => {
    const [row] = buildDeckRows([party({ goingCount: null, likePercentage: null, ratingCount: null })], {
      now: 0,
      isGoing: () => false,
    });
    expect(row.goingCount).toBeNull();
    expect(row.votes).toBeNull();
    expect(row.hostLikePct).toBeNull();
  });
});

describe('partyWindow / phaseAt (ET)', () => {
  const fri10pm = party({ date: '2026-04-10', doorsOpen: '10 PM', doorsClose: '2 AM' });

  it('is upcoming before doors, live at doors, past at close', () => {
    expect(phaseAt(fri10pm, new Date('2026-04-10T21:59:59-04:00'))).toBe('upcoming');
    expect(phaseAt(fri10pm, new Date('2026-04-10T22:00:00-04:00'))).toBe('live');
    expect(phaseAt(fri10pm, new Date('2026-04-11T01:59:59-04:00'))).toBe('live');
    expect(phaseAt(fri10pm, new Date('2026-04-11T02:00:00-04:00'))).toBe('past');
  });

  it('rolls a close at or before doors over to the next day', () => {
    const { startsAtMs, endsAtMs } = partyWindow(fri10pm);
    expect(endsAtMs - startsAtMs).toBe(4 * 3_600_000);
    const sameTime = partyWindow(party({ doorsOpen: '10 PM', doorsClose: '10 PM' }));
    expect(sameTime.endsAtMs - sameTime.startsAtMs).toBe(24 * 3_600_000);
  });

  it('puts doors before 6 AM on the next calendar day', () => {
    const late = party({ date: '2026-04-10', doorsOpen: '12 AM' });
    expect(partyWindow(late).startsAtMs).toBe(new Date('2026-04-11T00:00:00-04:00').getTime());
    expect(phaseAt(late, new Date('2026-04-10T23:30:00-04:00'))).toBe('upcoming');
  });

  it('treats 6 AM as the same day (rollover boundary)', () => {
    const early = party({ date: '2026-04-10', doorsOpen: '6 AM' });
    expect(partyWindow(early).startsAtMs).toBe(new Date('2026-04-10T06:00:00-04:00').getTime());
  });

  it('uses doors + 4h when there is no close', () => {
    const open = party({ doorsOpen: '9:30 PM', doorsClose: null });
    expect(phaseAt(open, new Date('2026-04-11T01:29:00-04:00'))).toBe('live');
    expect(phaseAt(open, new Date('2026-04-11T01:30:00-04:00'))).toBe('past');
  });

  it('uses the EST offset in winter', () => {
    const winter = party({ date: '2026-12-04', doorsOpen: '10 PM' });
    expect(partyWindow(winter).startsAtMs).toBe(new Date('2026-12-04T22:00:00-05:00').getTime());
  });

  it('accepts ISO timestamps as the date', () => {
    const iso = party({ date: '2026-04-10T00:00:00', doorsOpen: '10 PM' });
    expect(partyWindow(iso).startsAtMs).toBe(new Date('2026-04-10T22:00:00-04:00').getTime());
  });
});

describe('nightPhase / nightOf', () => {
  const thu = party({ date: '2026-04-09', doorsOpen: '10 PM', doorsClose: '2 AM' });
  const lateThu = party({ date: '2026-04-09', doorsOpen: '11 PM', doorsClose: '3 AM' });

  it('is past only once every party is over', () => {
    expect(nightPhase([thu, lateThu], new Date('2026-04-10T02:30:00-04:00'))).toBe('live');
    expect(nightPhase([thu, lateThu], new Date('2026-04-10T03:00:00-04:00'))).toBe('past');
    expect(nightPhase([thu, lateThu], new Date('2026-04-09T20:00:00-04:00'))).toBe('upcoming');
  });

  it('maps ET clock time to a party night with the 6 AM rollover', () => {
    expect(nightOf(new Date('2026-04-10T23:30:00-04:00'))).toBe('friday');
    expect(nightOf(new Date('2026-04-11T05:59:00-04:00'))).toBe('friday');
    expect(nightOf(new Date('2026-04-11T06:00:00-04:00'))).toBe('saturday');
    expect(nightOf(new Date('2026-04-13T12:00:00-04:00'))).toBeNull();
  });
});

describe('walkMinutesFromBellTower', () => {
  it('is at least 1 minute', () => {
    expect(walkMinutesFromBellTower(BELL_TOWER.lat, BELL_TOWER.lng)).toBe(1);
  });

  it('rounds up at 80 m/min', () => {
    // 0.01° of latitude ≈ 1,112 m → 13.9 → 14 min.
    expect(walkMinutesFromBellTower(BELL_TOWER.lat + 0.01, BELL_TOWER.lng)).toBe(14);
  });

  it('returns null for missing or (0, 0) coordinates', () => {
    expect(walkMinutesFromBellTower(0, 0)).toBeNull();
    expect(walkMinutesFromBellTower(null, -75.1)).toBeNull();
    expect(walkMinutesFromBellTower(Number.NaN, -75.1)).toBeNull();
  });
});

describe('priceLabels', () => {
  it('blank with no ticket link is Free', () => {
    expect(priceLabels({ ticketPrice: '', ticketUrl: null })).toEqual({ priceLabel: 'Free', priceShort: 'Free', isTicketed: false });
  });

  it('blank with a ticket link is Tickets / —', () => {
    expect(priceLabels({ ticketPrice: null, ticketUrl: 'https://posh.vip/e/x' })).toEqual({
      priceLabel: 'Tickets',
      priceShort: '—',
      isTicketed: true,
    });
  });

  it('keeps the host text as the label and reads the amount for the short form', () => {
    expect(priceLabels({ ticketPrice: '$15 presale / $20 door' })).toEqual({
      priceLabel: '$15 presale / $20 door',
      priceShort: '$15',
      isTicketed: true,
    });
  });

  it('reads "free entry" as Free', () => {
    expect(priceLabels({ ticketPrice: 'free entry' }).priceLabel).toBe('Free');
  });

  it('unreadable text keeps its label with a dash short form', () => {
    expect(priceLabels({ ticketPrice: 'DM @latinheattemple' })).toEqual({
      priceLabel: 'DM @latinheattemple',
      priceShort: '—',
      isTicketed: true,
    });
  });
});

describe('formatGoing', () => {
  it('shows a dash for soft-gated counts, never 0', () => {
    expect(formatGoing(null)).toBe('—');
    expect(formatGoing(0)).toBe('0');
  });

  it('abbreviates thousands', () => {
    expect(formatGoing(999)).toBe('999');
    expect(formatGoing(1204)).toBe('1.2k');
    expect(formatGoing(12_400)).toBe('12k');
  });
});

describe('meaningfulCategory', () => {
  it('keeps real categories as-is', () => {
    expect(meaningfulCategory('Rooftop Party')).toBe('Rooftop Party');
    expect(meaningfulCategory('  House Show ')).toBe('House Show');
  });
  it('drops "Other" (any case) and blanks — no label beats a meaningless one', () => {
    expect(meaningfulCategory('Other')).toBeNull();
    expect(meaningfulCategory('OTHER')).toBeNull();
    expect(meaningfulCategory('')).toBeNull();
    expect(meaningfulCategory(null)).toBeNull();
    expect(meaningfulCategory(undefined)).toBeNull();
  });
});
