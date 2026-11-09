/**
 * PartySheet — the map drawer's frost reskin (TUP-22).
 *
 * Two things are under test. First, the material: the root dialog carries
 * the `party-sheet` hook, the glass layer is the container's first child,
 * the stat tiles and GOING button wear the shared frost classes, and the
 * old solid `bg-temple-surface` shell is gone. Second, and more important,
 * that the reskin changed *nothing else* — every label, control, and the
 * Escape/share wiring still behave exactly as before.
 */

import { render, screen, fireEvent } from '@testing-library/react';
import PartySheet from '@/components/map/PartySheet';
import type { Party } from '@/lib/types';

/** Minimal party with real vote numbers, so VoteRow renders counts rather
 *  than the soft-gated dashes. No ticketUrl → the cover tile reads COVER. */
function makeParty(overrides: Partial<Party> = {}): Party {
  return {
    id: 'p1',
    title: 'Diamond St Kickback',
    host: 'Alpha House',
    pinLabel: 'ALPHA',
    category: 'House Party',
    day: 'friday',
    date: '2026-09-11',
    doorsOpen: '22:00',
    address: '1629 W Diamond St, Philadelphia, PA',
    latitude: 39.9812,
    longitude: -75.1573,
    goingCount: 42,
    likePercentage: 80,
    ratingCount: 10,
    isVerified: false,
    ratingOpen: true,
    hostStats: {
      displayName: 'Alpha House',
      partiesHosted: 3,
      avgLikePercentage: 80,
      logoUrl: null,
    },
    ...overrides,
  } as Party;
}

function renderSheet(party: Party = makeParty(), handlers: Record<string, jest.Mock> = {}) {
  const onClose = handlers.onClose ?? jest.fn();
  const onGoingClick = handlers.onGoingClick ?? jest.fn();
  const onNavigateClick = handlers.onNavigateClick ?? jest.fn();
  const onOpenParty = handlers.onOpenParty ?? jest.fn();
  const onShare = handlers.onShare ?? jest.fn();

  const utils = render(
    <PartySheet
      party={party}
      brand={null}
      isHeadliner={false}
      phase="upcoming"
      userIsGoing={false}
      onClose={onClose}
      onGoingClick={onGoingClick}
      onNavigateClick={onNavigateClick}
      onOpenParty={onOpenParty}
      onShare={onShare}
    />,
  );

  return { ...utils, onClose, onGoingClick, onNavigateClick, onOpenParty, onShare };
}

describe('PartySheet frost material', () => {
  it('puts the shared frost hook on the dialog and a glass layer inside it', () => {
    const { container } = renderSheet();

    expect(screen.getByRole('dialog').className).toContain('party-sheet');

    const glass = container.querySelector('.party-sheet__glass');
    expect(glass).not.toBeNull();
    expect(glass).toHaveAttribute('aria-hidden');
  });

  it('drops the old solid sheet shell', () => {
    renderSheet();

    // Scoped to the sheet container itself: StatTile still ships
    // bg-temple-surface in its own base classes (the .party-sheet__tile
    // rule overrides it at paint time), so a tree-wide query would match
    // the tiles and prove nothing about the shell.
    const shell = screen.getByRole('dialog').firstElementChild as HTMLElement;

    expect(shell.className).not.toContain('bg-temple-surface');
    expect(shell.className).not.toContain('border-t');
    expect(shell.className).not.toContain('shadow-[');
    expect(shell.className).toContain('rounded-t-[24px]');
    // The glass layer is the container's first child, under the content.
    expect(shell.firstElementChild).toHaveClass('party-sheet__glass');
  });

  it('frosts both stat tiles and the GOING button', () => {
    const { container } = renderSheet();

    expect(container.querySelectorAll('.party-sheet__tile')).toHaveLength(2);
    expect(screen.getByRole('button', { name: /GOING \(42\)/ }).className).toContain(
      'party-sheet__cta',
    );
  });
});

describe('PartySheet information structure (unchanged by the reskin)', () => {
  it('still renders the stat row, address, host line, and controls', () => {
    renderSheet();

    expect(screen.getByText('COVER')).toBeInTheDocument();
    expect(screen.getByText('STARTS')).toBeInTheDocument();
    expect(screen.getByText('SHARE')).toBeInTheDocument();
    expect(screen.getByText('1629 W Diamond St')).toBeInTheDocument();
    expect(screen.getByText(/3 parties hosted/)).toBeInTheDocument();
    expect(screen.getByLabelText('Navigate')).toBeInTheDocument();
    expect(screen.getByLabelText('Share this party')).toBeInTheDocument();
  });

  it('keeps the logged-out address soft gate', () => {
    renderSheet(makeParty({ address: null }));
    expect(screen.getByText('Sign in for address')).toBeInTheDocument();
  });

  it('still closes on Escape', () => {
    const onClose = jest.fn();
    renderSheet(makeParty(), { onClose });

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('still fires onShare from the share tile', () => {
    const onShare = jest.fn();
    renderSheet(makeParty(), { onShare });

    fireEvent.click(screen.getByLabelText('Share this party'));

    expect(onShare).toHaveBeenCalledTimes(1);
  });
});
