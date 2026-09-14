/**
 * TUP-15: /onboarding paints its first step in the static HTML instead of a
 * spinner, so LCP no longer waits on getSession() + GET /profiles/me.
 *
 * These tests pin the two halves of that trade: the pending render must be
 * real content (heading, wordmark, year buttons) with writes disabled, and
 * the redirects that used to live behind the useSearchParams Suspense
 * boundary must still fire now that `next` is read off window.location.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import OnboardingPage from '@/app/onboarding/page';

const mockUseAuth = jest.fn();

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock('@/utils/analytics', () => ({ trackEvent: jest.fn() }));

jest.mock('@/services/api', () => ({
  authApi: {
    checkUsernameAvailable: jest.fn().mockResolvedValue({ available: true }),
  },
}));

// Typed handle on the mock so the TUP-7 tests can make the availability
// check hang without settling.
const checkUsernameAvailable = jest.requireMock('@/services/api').authApi
  .checkUsernameAvailable as jest.Mock;

// jest.setup.js mocks next/navigation with a fresh replace() per render, which
// can't be asserted on. Override it with one shared spy.
const replace = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: jest.fn(), prefetch: jest.fn(), back: jest.fn() }),
  usePathname: () => '/onboarding',
}));

/** A finished profile — nothing left for the flow to collect. */
const completeUser = {
  id: 'u1',
  email: 'a@temple.edu',
  username: 'owl_party',
  isAdmin: false,
  isHost: false,
  createdAt: '2026-01-01T00:00:00Z',
  schoolYear: '2028',
  greekLife: null,
  instagram: null,
  avatarUrl: null,
};

/** Auth context defaults; each test overrides only what it cares about. */
function authState(overrides: Record<string, unknown> = {}) {
  return {
    user: null,
    isAuthenticated: false,
    isLoading: false,
    needsOnboarding: false,
    updateProfile: jest.fn().mockResolvedValue({ success: true }),
    uploadAvatar: jest.fn().mockResolvedValue({ success: true }),
    refreshUser: jest.fn().mockResolvedValue(undefined),
    logout: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('Onboarding page (TUP-15)', () => {
  beforeEach(() => {
    mockUseAuth.mockReset();
    replace.mockReset();
    checkUsernameAvailable.mockReset().mockResolvedValue({ available: true });
    window.history.replaceState({}, '', '/onboarding');
  });

  it('paints the first step — not a spinner — while auth is still loading', () => {
    mockUseAuth.mockReturnValue(
      authState({ isLoading: true, isAuthenticated: false, needsOnboarding: false, user: null })
    );

    const { container } = render(<OnboardingPage />);

    // The LCP element itself, present before any network round trip.
    expect(screen.getByRole('heading', { name: 'Class of' })).toBeInTheDocument();
    // Wordmark splits the logo across nodes (<span>tu</span>parties), so match
    // on the composed textContent of the span that holds exactly the wordmark.
    expect(
      screen.getByText(
        (_content, element) =>
          element?.tagName === 'SPAN' && element.textContent === 'tuparties'
      )
    ).toBeInTheDocument();
    expect(screen.getByText(/helps hosts know the crowd/i)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^Class of 20\d{2}$/ }).length).toBeGreaterThan(0);

    // Painted but inert: no writes until the profile lands.
    expect((screen.getByRole('button', { name: 'Continue' }) as HTMLButtonElement).disabled).toBe(
      true
    );
    expect(container.querySelector('.animate-spin')).toBeNull();
    expect(replace).not.toHaveBeenCalled();
  });

  it('keeps the same step for a new user and saves the picked year', async () => {
    const updateProfile = jest.fn().mockResolvedValue({ success: true });
    mockUseAuth.mockReturnValue(
      authState({
        isAuthenticated: true,
        needsOnboarding: true,
        updateProfile,
        user: { ...completeUser, username: null, schoolYear: null },
      })
    );

    render(<OnboardingPage />);

    // No swap from the pending render — this is why there's no CLS.
    expect(screen.getByRole('heading', { name: 'Class of' })).toBeInTheDocument();

    const yearButton = screen.getAllByRole('button', { name: /^Class of 20\d{2}$/ })[0];
    const year = (yearButton.textContent || '').replace('Class of ', '');
    fireEvent.click(yearButton);

    const button = screen.getByRole('button', { name: 'Continue' }) as HTMLButtonElement;
    await waitFor(() => expect(button.disabled).toBe(false));

    fireEvent.click(button);

    await waitFor(() => expect(updateProfile).toHaveBeenCalledWith({ school_year: year }));
  });

  it('advances to the username step when the year is already saved', async () => {
    mockUseAuth.mockReturnValue(
      authState({
        isAuthenticated: true,
        needsOnboarding: true,
        user: { ...completeUser, username: null, schoolYear: '2028' },
      })
    );

    render(<OnboardingPage />);

    expect(
      await screen.findByRole('heading', { name: 'Choose a username' })
    ).toBeInTheDocument();
  });

  it('still redirects an unauthenticated visitor to /login with ?next', async () => {
    window.history.replaceState({}, '', '/onboarding?next=%2Fparty%2Fabc');
    mockUseAuth.mockReturnValue(authState({ isLoading: false, isAuthenticated: false }));

    render(<OnboardingPage />);

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/login?next=%2Fparty%2Fabc'));
  });

  it('still sends an already-onboarded visitor to the next path', async () => {
    window.history.replaceState({}, '', '/onboarding?next=%2Fparty%2Fabc');
    mockUseAuth.mockReturnValue(
      authState({ isAuthenticated: true, needsOnboarding: false, user: completeUser })
    );

    render(<OnboardingPage />);

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/party/abc'));
  });
});

/**
 * TUP-7: Continue no longer waits on the debounced availability lookup.
 * Gating it on `checking` left the button dead for ~350ms+ after the last
 * keystroke, which read as broken and produced rageclicks on /onboarding.
 */
describe('Onboarding username step (TUP-7)', () => {
  /** Land straight on the username step: year saved, username still missing. */
  function renderUsernameStep(overrides: Record<string, unknown> = {}) {
    const updateProfile =
      (overrides.updateProfile as jest.Mock) ?? jest.fn().mockResolvedValue({ success: true });
    mockUseAuth.mockReturnValue(
      authState({
        isAuthenticated: true,
        needsOnboarding: true,
        ...overrides,
        updateProfile,
        user: { ...completeUser, username: null, schoolYear: '2028' },
      })
    );
    render(<OnboardingPage />);
    return { updateProfile };
  }

  beforeEach(() => {
    mockUseAuth.mockReset();
    replace.mockReset();
    checkUsernameAvailable.mockReset().mockResolvedValue({ available: true });
    window.history.replaceState({}, '', '/onboarding');
  });

  it('submits a valid username while the availability check is still pending', async () => {
    // Never settles — stands in for a slow network on the debounced lookup.
    checkUsernameAvailable.mockReturnValue(new Promise(() => {}));

    const { updateProfile } = renderUsernameStep();

    await screen.findByRole('heading', { name: 'Choose a username' });
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'owl_party' } });

    const button = screen.getByRole('button', { name: 'Continue' }) as HTMLButtonElement;
    expect(button.disabled).toBe(false);

    fireEvent.click(button);

    await waitFor(() => expect(updateProfile).toHaveBeenCalledWith({ username: 'owl_party' }));
  });

  it('keeps Continue disabled for a username that fails the pattern', async () => {
    renderUsernameStep();

    await screen.findByRole('heading', { name: 'Choose a username' });
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'a' } });

    expect((screen.getByRole('button', { name: 'Continue' }) as HTMLButtonElement).disabled).toBe(
      true
    );
  });

  it('marks the name taken and disables Continue when the server rejects it', async () => {
    const updateProfile = jest
      .fn()
      .mockResolvedValue({ success: false, error: 'Username already taken' });
    renderUsernameStep({ updateProfile });

    await screen.findByRole('heading', { name: 'Choose a username' });
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'owl_party' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    // The optimistic submit is the whole point of TUP-7 — the server stays
    // the authority on collisions, and its verdict has to reach the UI.
    expect(await screen.findByText('Already taken')).toBeInTheDocument();
    await waitFor(() =>
      expect((screen.getByRole('button', { name: 'Continue' }) as HTMLButtonElement).disabled).toBe(
        true
      )
    );
  });
});
