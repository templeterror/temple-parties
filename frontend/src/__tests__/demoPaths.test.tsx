import { render } from '@testing-library/react';
import RankingRow from '@/components/RankingRow';
import { DemoModeProvider } from '@/contexts/DemoModeContext';
import type { PartyRanking } from '@/lib/types';

const party: PartyRanking = {
  id: 'demo-fri-headliner',
  title: 'FREAKNIK',
  host: 'Eco Hall',
  category: 'Club',
  day: 'friday',
  date: '2026-04-10',
  doorsOpen: '10:30 PM',
  likePercentage: 91,
  ratingCount: 64,
  goingCount: 186,
  userRating: null,
};

describe('RankingRow demo links', () => {
  it('points at /demo/party when DemoMode is on', () => {
    const { container } = render(
      <DemoModeProvider>
        <RankingRow rank={1} party={party} />
      </DemoModeProvider>,
    );
    const href = container.querySelector('a')?.getAttribute('href');
    expect(href).toBe('/demo/party/demo-fri-headliner');
  });

  it('points at the live party page outside DemoMode', () => {
    const { container } = render(<RankingRow rank={1} party={party} />);
    const href = container.querySelector('a')?.getAttribute('href');
    expect(href).toBe('/party/demo-fri-headliner');
  });
});
