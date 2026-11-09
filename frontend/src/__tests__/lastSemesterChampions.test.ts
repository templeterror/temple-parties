import { isLastSemesterChampion } from '@/lib/lastSemesterChampions';
import { parseRankingsFilter } from '@/utils/ranks';

describe('isLastSemesterChampion', () => {
  it('matches Latin Heat case-insensitively', () => {
    expect(isLastSemesterChampion('Latin Heat')).toBe(true);
    expect(isLastSemesterChampion('latin heat')).toBe(true);
    expect(isLastSemesterChampion('  LATIN HEAT  ')).toBe(true);
  });

  it('does not match other hosts or empty names', () => {
    expect(isLastSemesterChampion('Other')).toBe(false);
    expect(isLastSemesterChampion('')).toBe(false);
    expect(isLastSemesterChampion(null)).toBe(false);
    expect(isLastSemesterChampion(undefined)).toBe(false);
  });
});

describe('parseRankingsFilter', () => {
  it('accepts the four dropdown values', () => {
    expect(parseRankingsFilter('by-hosts')).toBe('by-hosts');
    expect(parseRankingsFilter('last-week')).toBe('last-week');
    expect(parseRankingsFilter('this-month')).toBe('this-month');
    expect(parseRankingsFilter('this-semester')).toBe('this-semester');
  });

  it('returns null for unknown or empty values', () => {
    expect(parseRankingsFilter('nope')).toBeNull();
    expect(parseRankingsFilter(null)).toBeNull();
    expect(parseRankingsFilter(undefined)).toBeNull();
    expect(parseRankingsFilter('')).toBeNull();
  });
});
