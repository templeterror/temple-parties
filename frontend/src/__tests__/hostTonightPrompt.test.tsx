/**
 * Host prompt: cadence (host daily Wed–Sat vs regular Friday), CTA, consume keys.
 */

import { render, screen, fireEvent, act } from '@testing-library/react';
import {
  canPostParty,
  HOST_TONIGHT_CTA,
  hostTonightBody,
  hostTonightHref,
  hostTonightStorageKey,
  isHostTonightForceParam,
  LOOKING_COUNT_MAX,
  LOOKING_COUNT_MIN,
  lookingCountForWindow,
  readHostTonightConsumed,
  shouldShowHostTonightPrompt,
} from '@/lib/hostTonightPrompt';
import HostTonightPrompt from '@/components/HostTonightPrompt';

const WED = new Date(2026, 8, 9, 15, 0, 0);
const THU = new Date(2026, 8, 10, 15, 0, 0);
const FRI = new Date(2026, 8, 11, 15, 0, 0);
const SAT = new Date(2026, 8, 12, 15, 0, 0);
const SUN = new Date(2026, 8, 13, 15, 0, 0);

const USER_A = 'user-a';
const USER_B = 'user-b';
const HOST_ID = 'host-1';

const mockAuth = {
  user: { id: USER_A, isHost: false, isAdmin: false } as {
    id: string;
    isHost: boolean;
    isAdmin: boolean;
  } | null,
  isLoading: false,
  isAuthenticated: true,
};

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockAuth,
}));

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

describe('hostTonightPrompt helpers', () => {
  it('sends hosts and admins to create, everyone else to become-host', () => {
    expect(hostTonightHref({ isHost: true, isAdmin: false })).toBe('/create');
    expect(hostTonightHref({ isHost: false, isAdmin: true })).toBe('/create');
    expect(hostTonightHref({ isHost: false, isAdmin: false })).toBe('/become-host');
    expect(hostTonightHref(null)).toBe('/become-host');
    expect(canPostParty({ isHost: true })).toBe(true);
  });

  it('talks about posting, not becoming a host', () => {
    expect(HOST_TONIGHT_CTA).toBe('Post a party');
    expect(hostTonightBody(247)).toBe('247 students are looking now, put it on the feed!');
    expect(hostTonightBody(150)).not.toMatch(/host account/i);
    expect(HOST_TONIGHT_CTA).not.toMatch(/become/i);
  });

  it('picks 150–350 without replacement, then skips the last draw', () => {
    localStorage.clear();
    const poolSize = LOOKING_COUNT_MAX - LOOKING_COUNT_MIN + 1;
    const seen = new Set<number>();
    for (let i = 0; i < poolSize; i++) {
      const n = lookingCountForWindow(`week-${i}`);
      expect(n).toBeGreaterThanOrEqual(LOOKING_COUNT_MIN);
      expect(n).toBeLessThanOrEqual(LOOKING_COUNT_MAX);
      expect(seen.has(n)).toBe(false);
      seen.add(n);
    }
    expect(seen.size).toBe(poolSize);
    expect(lookingCountForWindow('week-0')).toBe(lookingCountForWindow('week-0'));
    const lastOfDeck = lookingCountForWindow(`week-${poolSize - 1}`);
    const wrapped = lookingCountForWindow('week-wrap');
    expect(wrapped).toBeGreaterThanOrEqual(LOOKING_COUNT_MIN);
    expect(wrapped).toBeLessThanOrEqual(LOOKING_COUNT_MAX);
    expect(wrapped).not.toBe(lastOfDeck);
  });

  it('keys hosts per rolled day and regulars only on Friday', () => {
    expect(hostTonightStorageKey({ now: FRI, userId: USER_A })).toBe(`r:${USER_A}:2026-09-11`);
    expect(hostTonightStorageKey({ now: SAT, userId: USER_A })).toBeNull();
    expect(hostTonightStorageKey({ now: THU, userId: USER_A })).toBeNull();
    expect(hostTonightStorageKey({ now: WED, isHost: true, userId: HOST_ID })).toBe(
      `h:${HOST_ID}:2026-09-09`,
    );
    expect(hostTonightStorageKey({ now: SAT, isHost: true, userId: HOST_ID })).toBe(
      `h:${HOST_ID}:2026-09-12`,
    );
    expect(hostTonightStorageKey({ now: SUN, isHost: true, userId: HOST_ID })).toBeNull();
    expect(hostTonightStorageKey({ now: THU, force: true, userId: USER_A })).toBe(
      `force:${USER_A}:2026-09-10`,
    );
  });

  it('shows regulars once on Friday Home, hosts once a day Wed–Sat', () => {
    expect(
      shouldShowHostTonightPrompt({
        pathname: '/',
        now: FRI,
        userId: USER_A,
        consumedKeys: {},
      }).show,
    ).toBe(true);
    expect(
      shouldShowHostTonightPrompt({
        pathname: '/',
        now: SAT,
        userId: USER_A,
        consumedKeys: {},
      }).show,
    ).toBe(false);
    expect(
      shouldShowHostTonightPrompt({
        pathname: '/',
        now: THU,
        userId: USER_A,
        consumedKeys: {},
      }).show,
    ).toBe(false);
    expect(
      shouldShowHostTonightPrompt({
        pathname: '/map',
        now: FRI,
        userId: USER_A,
        consumedKeys: {},
      }).show,
    ).toBe(false);
    expect(
      shouldShowHostTonightPrompt({
        pathname: '/',
        now: WED,
        isHost: true,
        userId: HOST_ID,
        consumedKeys: {},
      }).show,
    ).toBe(true);
    expect(
      shouldShowHostTonightPrompt({
        pathname: '/',
        now: SUN,
        isHost: true,
        userId: HOST_ID,
        consumedKeys: {},
      }).show,
    ).toBe(false);
    expect(
      shouldShowHostTonightPrompt({
        pathname: '/',
        now: THU,
        force: true,
        userId: USER_A,
        consumedKeys: {},
      }).show,
    ).toBe(true);
    expect(
      shouldShowHostTonightPrompt({
        pathname: '/',
        now: FRI,
        userId: USER_A,
        consumedKeys: { [`r:${USER_A}:2026-09-11`]: true },
      }).show,
    ).toBe(false);
  });

  it('does not share consume slots across accounts on the same phone', () => {
    const consumed = { [`r:${USER_A}:2026-09-11`]: true };
    expect(
      shouldShowHostTonightPrompt({
        pathname: '/',
        now: FRI,
        userId: USER_A,
        consumedKeys: consumed,
      }).show,
    ).toBe(false);
    expect(
      shouldShowHostTonightPrompt({
        pathname: '/',
        now: FRI,
        userId: USER_B,
        consumedKeys: consumed,
      }).show,
    ).toBe(true);
  });

  it('reads host_prompt=1 as the QA override', () => {
    expect(isHostTonightForceParam('?host_prompt=1')).toBe(true);
    expect(isHostTonightForceParam('')).toBe(false);
  });
});

describe('HostTonightPrompt', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    mockAuth.user = { id: USER_A, isHost: false, isAdmin: false };
    mockAuth.isLoading = false;
    mockAuth.isAuthenticated = true;
    jest.useFakeTimers();
    jest.setSystemTime(FRI);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('slides in after a beat asking to post, and sends non-hosts to become-host', () => {
    render(<HostTonightPrompt />);
    expect(screen.queryByText('Throwing a party?')).toBeNull();

    act(() => {
      jest.advanceTimersByTime(1100);
    });

    expect(screen.getByText('Throwing a party?')).toBeTruthy();
    const body = screen.getByText(/\d+ students are looking now, put it on the feed!/);
    const count = Number(body.textContent?.match(/(\d+)/)?.[1]);
    expect(count).toBeGreaterThanOrEqual(LOOKING_COUNT_MIN);
    expect(count).toBeLessThanOrEqual(LOOKING_COUNT_MAX);
    const cta = screen.getByRole('link', { name: HOST_TONIGHT_CTA });
    expect(cta.getAttribute('href')).toBe('/become-host');
  });

  it('sends hosts to create-party with the same post copy', () => {
    mockAuth.user = { id: HOST_ID, isHost: true, isAdmin: false };
    render(<HostTonightPrompt />);
    act(() => {
      jest.advanceTimersByTime(1100);
    });
    const cta = screen.getByRole('link', { name: HOST_TONIGHT_CTA });
    expect(cta.getAttribute('href')).toBe('/create');
    expect(screen.getByText(/\d+ students are looking now, put it on the feed!/)).toBeTruthy();
  });

  it('does not show regulars on Saturday', () => {
    jest.setSystemTime(SAT);
    render(<HostTonightPrompt />);
    act(() => {
      jest.advanceTimersByTime(1100);
    });
    expect(screen.queryByText('Throwing a party?')).toBeNull();
  });

  it('shows hosts on Saturday and stays gone after that day’s reveal', () => {
    mockAuth.user = { id: HOST_ID, isHost: true, isAdmin: false };
    jest.setSystemTime(SAT);
    const { unmount } = render(<HostTonightPrompt />);
    act(() => {
      jest.advanceTimersByTime(1100);
    });
    expect(screen.getByText('Throwing a party?')).toBeTruthy();
    expect(readHostTonightConsumed()[`h:${HOST_ID}:2026-09-12`]).toBe(true);
    unmount();
    render(<HostTonightPrompt />);
    act(() => {
      jest.advanceTimersByTime(1100);
    });
    expect(screen.queryByText('Throwing a party?')).toBeNull();
  });

  it('stays gone for the rest of Friday after a downward swipe', () => {
    render(<HostTonightPrompt />);
    act(() => {
      jest.advanceTimersByTime(1100);
    });
    const sheet = screen.getByRole('dialog', { name: /throwing a party/i });
    expect(screen.queryByRole('button', { name: 'Dismiss' })).toBeNull();
    act(() => {
      fireEvent.pointerDown(sheet, { clientY: 200, pointerId: 1, pointerType: 'touch' });
      fireEvent.pointerMove(sheet, { clientY: 310, pointerId: 1, pointerType: 'touch' });
      fireEvent.pointerUp(sheet, { pointerId: 1, pointerType: 'touch' });
    });
    expect(screen.queryByText('Throwing a party?')).toBeNull();
    expect(readHostTonightConsumed()[`r:${USER_A}:2026-09-11`]).toBe(true);
  });

  it('stays gone after Escape', () => {
    render(<HostTonightPrompt />);
    act(() => {
      jest.advanceTimersByTime(1100);
    });
    act(() => {
      fireEvent.keyDown(window, { key: 'Escape' });
    });
    expect(screen.queryByText('Throwing a party?')).toBeNull();
    expect(readHostTonightConsumed()[`r:${USER_A}:2026-09-11`]).toBe(true);
  });

  it('does not show for logged-out visitors', () => {
    mockAuth.isAuthenticated = false;
    render(<HostTonightPrompt />);
    act(() => {
      jest.advanceTimersByTime(1100);
    });
    expect(screen.queryByText('Throwing a party?')).toBeNull();
  });
});
