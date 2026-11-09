import type { HostRanking, PartyRanking } from '@/lib/types';
import {
  emptyStateNextFilter,
  formatLikePct,
  monogram,
  parseRankingsFilter,
  partiesHostedLabel,
  podiumOrder,
  posterInitials,
  posterWord,
  RANK_THRESHOLD,
  RANKINGS_FILTERS,
  splitHostRankings,
  splitPartyRankings,
  votesLabel,
} from '@/utils/ranks';

function party(id: string, ratingCount: number, likePercentage = 80): PartyRanking {
  return {
    id,
    title: id,
    host: 'Host',
    category: 'Other',
    day: 'friday',
    date: '2026-04-10',
    doorsOpen: '10 PM',
    likePercentage,
    ratingCount,
    goingCount: 0,
    userRating: null,
  };
}

function host(hostCode: string, isEligible: boolean, finalScore = 0.5): HostRanking {
  return {
    hostCode,
    displayName: hostCode,
    logoUrl: null,
    partiesHosted: 2,
    totalRatingCount: 20,
    totalGoingCount: 0,
    avgLikePercentage: 80,
    bayesianScore: 0.5,
    finalScore,
    isEligible,
  };
}

describe('splitPartyRankings', () => {
  it('ranks at exactly the threshold and not one vote below', () => {
    expect(RANK_THRESHOLD).toBe(5);
    const { ranked, unranked } = splitPartyRankings([party('four', 4), party('five', 5)]);
    expect(ranked.map((p) => p.id)).toEqual(['five']);
    expect(unranked.map((p) => p.id)).toEqual(['four']);
  });

  it('keeps the server order inside each group', () => {
    const rows = [party('a', 64, 91), party('b', 2, 100), party('c', 12, 88), party('d', 0, 0), party('e', 5, 60)];
    const { ranked, unranked } = splitPartyRankings(rows);
    expect(ranked.map((p) => p.id)).toEqual(['a', 'c', 'e']);
    expect(unranked.map((p) => p.id)).toEqual(['b', 'd']);
  });

  it('handles an empty period', () => {
    expect(splitPartyRankings([])).toEqual({ ranked: [], unranked: [] });
  });
});

describe('splitHostRankings', () => {
  it('puts eligible hosts first and keeps order inside each group', () => {
    const rows = [host('x', false, 0.9), host('a', true, 0.8), host('y', false, 0.7), host('b', true, 0.6)];
    const { ranked, unranked } = splitHostRankings(rows);
    expect(ranked.map((h) => h.hostCode)).toEqual(['a', 'b']);
    expect(unranked.map((h) => h.hostCode)).toEqual(['x', 'y']);
  });
});

describe('podiumOrder', () => {
  it('lays the top three out as 2 · 1 · 3', () => {
    expect(podiumOrder(['1st', '2nd', '3rd'])).toEqual(['2nd', '1st', '3rd']);
  });

  it('handles short podiums', () => {
    expect(podiumOrder(['1st', '2nd'])).toEqual(['2nd', '1st']);
    expect(podiumOrder(['1st'])).toEqual(['1st']);
    expect(podiumOrder([])).toEqual([]);
  });
});

describe('monogram', () => {
  it('takes the first letters of the first two words', () => {
    expect(monogram('Latin Heat')).toBe('LH');
    expect(monogram('alpha phi alpha')).toBe('AP');
  });

  it('copes with odd names', () => {
    expect(monogram('Pike')).toBe('P');
    expect(monogram('  ΣΦΕ  ')).toBe('?');
    expect(monogram('🎉🎉')).toBe('?');
    expect(monogram('')).toBe('?');
    expect(monogram('D.J. Kool')).toBe('DJ');
    expect(monogram('---the_house---')).toBe('TH');
    expect(monogram('4th St Collective')).toBe('4S');
  });
});

describe('labels', () => {
  it('votesLabel is singular for one vote', () => {
    expect(votesLabel(1)).toBe('1 vote');
    expect(votesLabel(0)).toBe('0 votes');
    expect(votesLabel(64)).toBe('64 votes');
  });

  it('partiesHostedLabel is singular for one party', () => {
    expect(partiesHostedLabel(1)).toBe('1 party hosted');
    expect(partiesHostedLabel(16)).toBe('16 parties hosted');
  });

  it('formatLikePct rounds', () => {
    expect(formatLikePct(90.6)).toBe('91%');
    expect(formatLikePct(0)).toBe('0%');
  });

  it('posterWord / posterInitials skip articles', () => {
    expect(posterWord('The Red Party')).toBe('Red');
    expect(posterInitials('Latin Heat Perreo')).toBe('LH');
    expect(posterInitials('The')).toBe('T');
    expect(posterWord('!!!')).toBe('?');
  });
});

describe('period filter', () => {
  it('parses every menu value', () => {
    for (const f of RANKINGS_FILTERS) expect(parseRankingsFilter(f)).toBe(f);
  });

  it('returns null for an unknown filter', () => {
    expect(parseRankingsFilter('all-time')).toBeNull();
    expect(parseRankingsFilter('BY-HOSTS')).toBeNull();
    expect(parseRankingsFilter('')).toBeNull();
    expect(parseRankingsFilter(null)).toBeNull();
  });

  it('empty states point somewhere new', () => {
    expect(emptyStateNextFilter('last-week')).toBe('this-semester');
    expect(emptyStateNextFilter('this-month')).toBe('this-semester');
    expect(emptyStateNextFilter('this-semester')).toBe('by-hosts');
    expect(emptyStateNextFilter('by-hosts')).toBe('this-semester');
  });
});
