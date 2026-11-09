import { render } from '@testing-library/react';
import RanksPodium, { RanksPodiumPartyStep } from '@/components/ranks/RanksPodium';
import { RanksPartyRow } from '@/components/ranks/RanksRow';
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

function hrefOf(container: HTMLElement): string | null | undefined {
  return container.querySelector('a')?.getAttribute('href');
}

describe('RanksPartyRow demo links', () => {
  it('points at /demo/party when DemoMode is on', () => {
    const { container } = render(
      <DemoModeProvider>
        <RanksPartyRow rank={4} party={party} />
      </DemoModeProvider>,
    );
    expect(hrefOf(container)).toBe('/demo/party/demo-fri-headliner');
  });

  it('points at the live party page outside DemoMode', () => {
    const { container } = render(<RanksPartyRow rank={4} party={party} />);
    expect(hrefOf(container)).toBe('/party/demo-fri-headliner');
  });

  it('unranked rows link the same way', () => {
    const { container } = render(
      <DemoModeProvider>
        <RanksPartyRow rank={null} party={party} />
      </DemoModeProvider>,
    );
    expect(hrefOf(container)).toBe('/demo/party/demo-fri-headliner');
  });
});

describe('RanksPodiumPartyStep demo links', () => {
  const step = <RanksPodiumPartyStep rank={1} party={party} eyebrow="#1 last weekend" />;

  it('points at /demo/party when DemoMode is on', () => {
    const { container } = render(
      <DemoModeProvider>
        <RanksPodium count={1}>{step}</RanksPodium>
      </DemoModeProvider>,
    );
    expect(hrefOf(container)).toBe('/demo/party/demo-fri-headliner');
  });

  it('points at the live party page outside DemoMode', () => {
    const { container } = render(<RanksPodium count={1}>{step}</RanksPodium>);
    expect(hrefOf(container)).toBe('/party/demo-fri-headliner');
  });

  it('announces its rank and period', () => {
    const { container } = render(<RanksPodium count={1}>{step}</RanksPodium>);
    expect(container.querySelector('a')?.getAttribute('aria-label')).toBe(
      '#1 last weekend: FREAKNIK, by Eco Hall, 91% liked, 64 votes',
    );
  });
});
