import { render, screen } from '@testing-library/react';
import AuthGate from '@/components/AuthGate';

const mockUseAuth = jest.fn();

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock('@/utils/analytics', () => ({ trackEvent: jest.fn() }));

describe('AuthGate', () => {
  beforeEach(() => {
    mockUseAuth.mockReset();
  });

  it('shows the signup wall over the live app when logged out', async () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      signInWithMicrosoft: jest.fn().mockResolvedValue({ success: true }),
    });

    render(
      <AuthGate>
        <p>feed content</p>
      </AuthGate>
    );

    expect(await screen.findByRole('dialog', { name: /party's inside/i })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.getByText('feed content')).toBeInTheDocument();
  });

  it('does not wall a signed-in session', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      signInWithMicrosoft: jest.fn(),
    });

    render(
      <AuthGate>
        <p>feed content</p>
      </AuthGate>
    );

    expect(screen.getByText('feed content')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('waits for auth to resolve so a session never flashes the wall', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      isLoading: true,
      signInWithMicrosoft: jest.fn(),
    });

    render(
      <AuthGate>
        <p>feed content</p>
      </AuthGate>
    );

    expect(screen.getByText('feed content')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('does not render the live app until onboarding is finished', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      needsOnboarding: true,
      signInWithMicrosoft: jest.fn(),
    });

    render(
      <AuthGate>
        <p>feed content</p>
      </AuthGate>
    );

    expect(screen.queryByText('feed content')).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
