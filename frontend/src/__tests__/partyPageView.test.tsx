/**
 * PartyPageView — the party page's presentation (DESIGN.md "Party page →
 * Deck"). Pins the behaviour the browser pass can't reach in the demo
 * (no demo party carries a promo code or a ticket link): Copy promo, the
 * ticketed primary, the one soft gate, the tappable crown, share-only.
 *
 * Plain jest matchers on purpose (jest-dom types aren't visible to tsc).
 */

import { act, fireEvent, render, screen } from '@testing-library/react';
import PartyPageView, { type PartyPageViewProps } from '@/components/party/PartyPageView';
import type { Party } from '@/lib/types';
import { BELL_TOWER } from '@/utils/partyDeck';
import { buildPartyPage } from '@/utils/partyPage';

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('@/utils/analytics', () => ({ trackEvent: jest.fn() }));
jest.mock('@/utils/shareHelpers', () => ({ copyText: jest.fn(async () => true) }));

const LIVE = new Date('2026-04-10T23:30:00-04:00');
const TUESDAY = new Date('2026-04-14T12:00:00-04:00');

function party(overrides: Partial<Party> = {}): Party {
  return {
    id: 'p1',
    title: 'Latin Heat Perreo',
    host: 'Latin Heat',
    pinLabel: 'LH',
    category: 'House Party',
    day: 'friday',
    date: '2026-04-10',
    doorsOpen: '10 PM',
    doorsClose: '3 AM',
    address: '1600 N 15th St, Philadelphia, PA 19121',
    latitude: BELL_TOWER.lat,
    longitude: BELL_TOWER.lng,
    goingCount: 142,
    likePercentage: 90,
    ratingCount: 48,
    isVerified: true,
    ratingOpen: true,
    ratingLocked: false,
    promoLabel: '$2 OFF TICKETS',
    promoCode: 'HEAT2',
    promoHint: 'Use at checkout on Posh.',
    ...overrides,
  };
}

function renderView(p: Party, now: Date = LIVE, extra: Partial<PartyPageViewProps> = {}) {
  const handlers = {
    onGoing: jest.fn(),
    onNavigate: jest.fn(),
    onBuyTickets: jest.fn(),
    onRate: jest.fn(),
    onShare: jest.fn(),
    onPromoCopied: jest.fn(),
    onSignIn: jest.fn(),
    onOpenMap: jest.fn(),
  };
  render(
    <PartyPageView
      party={p}
      model={buildPartyPage({ party: p, now, isTop: false })}
      backHref="/"
      isGoing={false}
      userRating={null}
      {...handlers}
      {...extra}
    />,
  );
  return handlers;
}

describe('PartyPageView', () => {
  it('copies the promo code and reports it', async () => {
    const h = renderView(party());
    const copy = screen.getByRole('button', { name: 'Copy promo code HEAT2' });
    await act(async () => {
      fireEvent.click(copy);
    });
    expect(h.onPromoCopied).toHaveBeenCalledWith('HEAT2');
    expect(copy.getAttribute('data-copied')).toBe('true');
  });

  it('ticketed: Buy tickets is the one primary, and the list names the site (not the price)', () => {
    const h = renderView(party({ ticketUrl: 'https://posh.vip/e/heat?ref=tuparty', ticketPrice: '$15' }));
    expect(screen.queryByRole('button', { name: /I.m going/ })).toBeNull();
    const links = screen.getAllByRole('link', { name: /Buy tickets|Tickets on posh\.vip/ });
    expect(links).toHaveLength(2);
    fireEvent.click(links[1]);
    expect(h.onBuyTickets).toHaveBeenCalled();
    expect(screen.getAllByText('$15')).toHaveLength(1);
  });

  it('logged out: one gate, no promo code, dashes for going', () => {
    const h = renderView(party({ address: null, promoCode: null, goingCount: null, likePercentage: null, ratingCount: null }));
    expect(screen.getByText('Sign in with your .edu to see the address and promo code')).toBeTruthy();
    const signIns = screen.getAllByRole('button', { name: 'Sign in' });
    expect(signIns).toHaveLength(1);
    fireEvent.click(signIns[0]);
    expect(h.onSignIn).toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /Copy promo code/ })).toBeNull();
    expect(screen.getByText('—')).toBeTruthy();
  });

  it('the crown is a real button (opens LastSemesterChampModal); the seal is static', () => {
    renderView(party());
    expect(screen.getByRole('button', { name: '#1 host last semester' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Verified host' })).toBeNull();
  });

  it('the bar fires going / directions / share', () => {
    const h = renderView(party());
    fireEvent.click(screen.getByRole('button', { name: 'I’m going' }));
    fireEvent.click(screen.getByRole('button', { name: 'Directions' }));
    fireEvent.click(screen.getByRole('button', { name: 'Share' }));
    expect(h.onGoing).toHaveBeenCalled();
    expect(h.onNavigate).toHaveBeenCalled();
    expect(h.onShare).toHaveBeenCalledWith('cta');
  });

  it('over and voting closed: Share only, result + Voting closed', () => {
    renderView(party({ ratingOpen: false, ratingLocked: true }), TUESDAY);
    expect(screen.queryByRole('button', { name: /I.m going/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Directions' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Share' })).toBeTruthy();
    expect(screen.getByText('Voting closed')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Vote up' })).toBeNull();
  });
});
