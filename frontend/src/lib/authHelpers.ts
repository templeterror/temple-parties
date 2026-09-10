export const TEMPLE_EMAIL_SUFFIX = '@temple.edu';

export function isTempleEmail(email: string | null | undefined): boolean {
  return (email ?? '').trim().toLowerCase().endsWith(TEMPLE_EMAIL_SUFFIX);
}

/** Only allow in-app relative paths for post-login redirects. */
export function sanitizeNextPath(raw: string | null | undefined): string {
  const next = (raw ?? '').trim();
  if (!next.startsWith('/') || next.startsWith('//') || next.includes('\\')) {
    return '/';
  }
  return next;
}

export function microsoftCallbackUrl(origin: string, nextPath: string): string {
  const next = sanitizeNextPath(nextPath);
  const url = new URL('/auth/callback', origin);
  if (next !== '/') {
    url.searchParams.set('next', next);
  }
  return url.toString();
}

/** Keep `?next=` through the onboarding gate so SSO doesn't dump people on home. */
export function onboardingPath(nextPath: string): string {
  const next = sanitizeNextPath(nextPath);
  if (next === '/' || next.startsWith('/onboarding')) {
    return '/onboarding';
  }
  return `/onboarding?next=${encodeURIComponent(next)}`;
}

export function partyPath(partyId: string): string {
  return `/party/${partyId}`;
}

export function demoPartyPath(partyId: string): string {
  return `/demo/party/${partyId}`;
}

export function partyHref(partyId: string, demo: boolean): string {
  return demo ? demoPartyPath(partyId) : partyPath(partyId);
}

/**
 * Routes that must stay reachable without an account: sign-in, the Azure
 * callback, unfinished onboarding, and the recruiter demo snapshot.
 */
export function isAuthPublicPath(pathname: string): boolean {
  if (pathname === '/login' || pathname.startsWith('/login/')) return true;
  if (pathname === '/auth/callback' || pathname.startsWith('/auth/')) return true;
  if (pathname === '/onboarding' || pathname.startsWith('/onboarding')) return true;
  if (pathname === '/demo' || pathname.startsWith('/demo/')) return true;
  return false;
}

export type LoginPitch = { title: string; body: string };

/**
 * Primary login CTA. Same label idle and in-flight so a Back-from-TU-Portal
 * restore never shows a stuck "Redirecting…" (TUP-18).
 */
export function loginButtonLabel(submitting = false): string {
  if (submitting) return 'Sign in';
  return 'Sign in';
}

/** Re-enable the login CTA when the student returns via Back (bfcache). */
export function bindPageShow(onShow: () => void): () => void {
  window.addEventListener('pageshow', onShow);
  return () => window.removeEventListener('pageshow', onShow);
}

/**
 * Login headline + subcopy. One screen, Sign in button visible immediately —
 * the two-step Continue gate hid SSO and bounced half of /login visitors.
 */
export function loginPitch(
  nextPath: string,
  pendingType: 'going' | 'addParty' | null = null
): LoginPitch {
  if (pendingType === 'addParty' || nextPath.startsWith('/create')) {
    return {
      title: 'Sign in to post a party',
      body: 'school email only · about 10 seconds.',
    };
  }
  if (nextPath.startsWith('/become-host')) {
    return {
      title: 'Sign in to host',
      body: 'school email only · about 10 seconds.',
    };
  }
  if (pendingType === 'going' || nextPath.startsWith('/party/')) {
    return {
      title: "This one's on the lineup",
      body: 'school email only · about 10 seconds. You’ll land back here.',
    };
  }
  return {
    title: "The party's inside",
    body: 'school email only · about 10 seconds.',
  };
}

export function loginErrorFromQuery(params: URLSearchParams): string {
  const code = params.get('error');
  const description = (params.get('error_description') || params.get('error') || '').toLowerCase();

  if (code === 'temple' || description.includes('temple.edu')) {
    return 'Use your Temple email (@temple.edu)';
  }
  if (
    description.includes('admin') ||
    description.includes('aadsts65001') ||
    description.includes('aadsts90094')
  ) {
    return 'Temple has to approve this app before students can sign in. Ask IT, or try again after admin consent.';
  }
  if (code || params.get('error_description')) {
    return 'Sign-in failed. Try again.';
  }
  return '';
}
