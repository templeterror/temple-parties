/**
 * InviteModal — the post-GOING share drawer: party line, Share CTA, and
 * the three dismiss paths (Maybe later / backdrop / Escape / swipe down).
 */

import { render, screen, fireEvent, act } from '@testing-library/react';
import InviteModal from '@/components/InviteModal';
import type { Party } from '@/lib/types';
import { getDayName, displayDoorTime } from '@/utils/dateHelpers';

jest.mock('@/utils/analytics', () => ({ trackEvent: jest.fn() }));

if (typeof globalThis.PointerEvent === 'undefined') {
  class PointerEventPolyfill extends MouseEvent {
    pointerId: number;
    pointerType: string;
    constructor(type: string, init: MouseEventInit & { pointerId?: number; pointerType?: string } = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 1;
      this.pointerType = init.pointerType ?? 'touch';
    }
  }
  globalThis.PointerEvent = PointerEventPolyfill as unknown as typeof PointerEvent;
}

/** Minimal party: only the fields the drawer reads actually matter. */
function makeParty(overrides: Partial<Party> = {}): Party {
  return {
    id: 'party-1',
    title: 'Diamond St Darty',
    host: 'Alpha House',
    pinLabel: 'Alpha',
    category: 'Frat',
    day: 'friday',
    date: '2026-09-11',
    doorsOpen: '10 PM',
    address: '1629 W Diamond St',
    latitude: 39.98,
    longitude: -75.16,
    goingCount: 42,
    likePercentage: null,
    ratingCount: null,
    isVerified: false,
    posterImage: undefined,
    ...overrides,
  } as Party;
}

function setup(props: Partial<React.ComponentProps<typeof InviteModal>> = {}) {
  const onClose = jest.fn();
  const onShare = jest.fn();
  const utils = render(
    <InviteModal isOpen onClose={onClose} onShare={onShare} party={makeParty()} {...props} />,
  );
  return { onClose, onShare, ...utils };
}

describe('InviteModal', () => {
  it('renders nothing when closed', () => {
    setup({ isOpen: false });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('shows the party it was opened for', () => {
    const party = makeParty();
    setup({ party });

    expect(screen.getByRole('dialog', { name: /bring the crew/i })).toBeTruthy();
    expect(screen.getByText(party.title)).toBeTruthy();
    expect(screen.getByText(party.host)).toBeTruthy();
    expect(
      screen.getByText(
        `${getDayName(party.day)} @ ${displayDoorTime(party.doorsOpen)} · 42 going`,
      ),
    ).toBeTruthy();

    const cta = screen.getByRole('button', { name: /share with friends/i });
    expect(cta.className).toContain('invite-sheet__cta');
  });

  it('hides the count when goingCount is null (soft-gate: never a fake 0)', () => {
    setup({ party: makeParty({ goingCount: null }) });
    expect(screen.queryByText(/going/i)).toBeNull();
    expect(screen.getByText(/friday @ 10 pm/i)).toBeTruthy();
  });

  it('falls back to generic copy with no party', () => {
    setup({ party: null });
    expect(screen.getByText('Send the link so your friends pull up too.')).toBeTruthy();
    expect(screen.queryByText('Diamond St Darty')).toBeNull();
    expect(document.querySelector('img')).toBeNull();
  });

  it('shares then closes, once each', () => {
    const { onShare, onClose } = setup();
    fireEvent.click(screen.getByRole('button', { name: /share with friends/i }));
    expect(onShare).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on Maybe later without sharing', () => {
    const { onShare, onClose } = setup();
    fireEvent.click(screen.getByRole('button', { name: /maybe later/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onShare).not.toHaveBeenCalled();
  });

  it('closes on backdrop tap without sharing', () => {
    const { onShare, onClose } = setup();
    fireEvent.click(screen.getByTestId('modal-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onShare).not.toHaveBeenCalled();
  });

  it('closes on Escape without sharing', () => {
    const { onShare, onClose } = setup();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onShare).not.toHaveBeenCalled();
  });

  it('closes on a downward swipe without sharing', () => {
    const { onShare, onClose } = setup();
    const sheet = screen.getByRole('dialog');
    act(() => {
      fireEvent.pointerDown(sheet, { clientY: 200, pointerId: 1, pointerType: 'touch' });
      fireEvent.pointerMove(sheet, { clientY: 310, pointerId: 1, pointerType: 'touch' });
      fireEvent.pointerUp(sheet, { pointerId: 1, pointerType: 'touch' });
    });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onShare).not.toHaveBeenCalled();
  });
});
