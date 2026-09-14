'use client';

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { authApi } from '@/services/api';
import Wordmark from '@/components/ui/Wordmark';
import { sanitizeNextPath } from '@/lib/authHelpers';
import {
  ONBOARDING_STEPS,
  GRAD_YEARS,
  USERNAME_PATTERN,
  firstIncompleteStep,
  writeOnboardingComplete,
  type OnboardingStep,
} from '@/lib/onboarding';
import { resizeAvatarFile } from '@/utils/avatarImage';
import { trackEvent } from '@/utils/analytics';
import type { User } from '@/lib/types';
import type { AuthUser } from '@/contexts/AuthContext';

function toProfileUser(user: AuthUser): User {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    is_admin: user.isAdmin,
    created_at: user.createdAt,
    school_year: user.schoolYear,
    greek_life: user.greekLife,
    instagram: user.instagram,
    avatar_url: user.avatarUrl,
  };
}

/**
 * Read the `?next=` redirect target straight off the URL instead of through
 * `useSearchParams()`. That hook forces the whole page into a Suspense
 * bailout, so Next can't prerender any of it — the browser got an empty
 * shell and had to wait for JS before painting anything (TUP-15). Reading
 * `window.location` is client-only, so we guard for the server render and
 * fall back to '/', which is what an absent `next` sanitizes to anyway.
 */
function readNextPath(): string {
  if (typeof window === 'undefined') return '/';
  return sanitizeNextPath(new URLSearchParams(window.location.search).get('next'));
}

/**
 * FLOW 2 onboarding: school year → username → avatar → greek → instagram → home.
 * Required: school year + username. Optional steps offer Skip (completable later on /profile).
 */
function OnboardingFlow() {
  const router = useRouter();
  const {
    user,
    isAuthenticated,
    isLoading,
    needsOnboarding,
    updateProfile,
    uploadAvatar,
    refreshUser,
    logout,
  } = useAuth();

  const stepIndexOf = (s: OnboardingStep) => ONBOARDING_STEPS.indexOf(s);

  const [flowActive, setFlowActive] = useState(false);
  const [step, setStep] = useState<OnboardingStep>('school-year');
  const [schoolYear, setSchoolYear] = useState('');
  const [username, setUsername] = useState('');
  const [usernameStatus, setUsernameStatus] = useState<
    'idle' | 'checking' | 'available' | 'taken' | 'invalid'
  >('idle');
  const [greekLife, setGreekLife] = useState('');
  const [instagram, setInstagram] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pendingBlob, setPendingBlob] = useState<Blob | null>(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const checkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isLoading) return;

    const safeNext = readNextPath();

    if (!isAuthenticated) {
      router.replace(
        `/login?next=${encodeURIComponent(safeNext === '/' ? '/onboarding' : safeNext)}`
      );
      return;
    }

    // Already past required fields and not mid-flow → resume soft-gate destination.
    if (!needsOnboarding && !flowActive) {
      router.replace(safeNext);
      return;
    }

    if (flowActive || !user) return;

    setFlowActive(true);
    setStep(firstIncompleteStep(toProfileUser(user)));
    if (user.schoolYear) setSchoolYear(user.schoolYear);
    if (user.username) setUsername(user.username);
    if (user.greekLife) setGreekLife(user.greekLife);
    if (user.instagram) setInstagram(user.instagram);
    if (user.avatarUrl) setPreviewUrl(user.avatarUrl);
  }, [flowActive, isAuthenticated, isLoading, needsOnboarding, router, user]);

  // Kill any in-flight debounce when the page goes away (TUP-7), otherwise the
  // timer fires post-unmount and setUsernameStatus warns about setting state on
  // a component that no longer exists.
  useEffect(() => {
    return () => {
      if (checkTimer.current) {
        clearTimeout(checkTimer.current);
        checkTimer.current = null;
      }
    };
  }, []);

  const runUsernameCheck = useCallback((value: string) => {
    if (checkTimer.current) clearTimeout(checkTimer.current);
    const cleaned = value.trim();
    if (!cleaned) {
      setUsernameStatus('idle');
      return;
    }
    if (!USERNAME_PATTERN.test(cleaned)) {
      setUsernameStatus('invalid');
      return;
    }
    setUsernameStatus('checking');
    checkTimer.current = setTimeout(async () => {
      try {
        const result = await authApi.checkUsernameAvailable(cleaned);
        setUsernameStatus(result.available ? 'available' : 'taken');
      } catch {
        setUsernameStatus('idle');
      }
    }, 350);
  }, []);

  const finishOnboarding = useCallback(async () => {
    if (user?.id) writeOnboardingComplete(user.id);
    trackEvent('onboarding_completed', {
      has_avatar: !!(pendingBlob || user?.avatarUrl),
      has_greek_life: !!greekLife.trim(),
      has_instagram: !!instagram.trim(),
    });
    await refreshUser();
    setFlowActive(false);
    router.replace(readNextPath());
  }, [greekLife, instagram, pendingBlob, refreshUser, router, user?.avatarUrl, user?.id]);

  const goNext = useCallback(() => {
    const next = ONBOARDING_STEPS[ONBOARDING_STEPS.indexOf(step) + 1];
    if (next) {
      setStep(next);
      setError('');
      return;
    }
    void finishOnboarding();
  }, [finishOnboarding, step]);

  const saveSchoolYear = async (e: FormEvent) => {
    e.preventDefault();
    // Pre-auth the form is painted but inert — no profile to write to yet.
    if (!flowActive || !schoolYear) return;
    setSubmitting(true);
    setError('');
    const result = await updateProfile({ school_year: schoolYear });
    setSubmitting(false);
    if (!result.success) {
      setError(result.error || 'Could not save school year');
      return;
    }
    goNext();
  };

  const saveUsername = async (e: FormEvent) => {
    e.preventDefault();
    const cleaned = username.trim();
    if (!USERNAME_PATTERN.test(cleaned) || usernameStatus === 'taken') return;
    // Drop any debounced availability check still waiting to fire (TUP-7).
    // Continue no longer waits on that request, so a late response could
    // otherwise land after the save and flip the hint to "taken" on a
    // username we just successfully claimed. The server is the real
    // authority here — a genuine conflict comes back as a /taken/i error
    // below and sets the status then.
    if (checkTimer.current) {
      clearTimeout(checkTimer.current);
      checkTimer.current = null;
    }
    setSubmitting(true);
    setError('');
    const result = await updateProfile({ username: cleaned });
    setSubmitting(false);
    if (!result.success) {
      setError(result.error || 'Could not save username');
      if (/taken/i.test(result.error || '')) setUsernameStatus('taken');
      return;
    }
    goNext();
  };

  const onPickAvatar = async (file: File | null) => {
    if (!file) return;
    setError('');
    try {
      const blob = await resizeAvatarFile(file);
      if (previewUrl?.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
      setPendingBlob(blob);
      setPreviewUrl(URL.createObjectURL(blob));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not process image');
    }
  };

  const saveAvatar = async (e: FormEvent) => {
    e.preventDefault();
    if (!pendingBlob) {
      goNext();
      return;
    }
    setSubmitting(true);
    setError('');
    const result = await uploadAvatar(pendingBlob);
    setSubmitting(false);
    if (!result.success) {
      setError(result.error || 'Upload failed');
      return;
    }
    setPendingBlob(null);
    goNext();
  };

  const saveGreek = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    if (greekLife.trim()) {
      const result = await updateProfile({ greek_life: greekLife.trim() });
      if (!result.success) {
        setSubmitting(false);
        setError(result.error || 'Could not save');
        return;
      }
    }
    setSubmitting(false);
    goNext();
  };

  const saveInstagram = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    if (instagram.trim()) {
      const result = await updateProfile({ instagram: instagram.trim() });
      if (!result.success) {
        setSubmitting(false);
        setError(result.error || 'Could not save');
        return;
      }
    }
    setSubmitting(false);
    await finishOnboarding();
  };

  const usernameHint = useMemo(() => {
    switch (usernameStatus) {
      case 'checking':
        return 'Checking…';
      case 'available':
        return 'Available';
      case 'taken':
        return 'Already taken';
      case 'invalid':
        return '2–30 letters, numbers, or underscore';
      default:
        return '2–30 letters, numbers, or underscore';
    }
  }, [usernameStatus]);

  /**
   * Why this renders the first step instead of a spinner (TUP-15).
   *
   * The old LCP chain was strictly serial: static HTML → download JS →
   * hydrate → supabase getSession() → GET /profiles/me → only THEN swap the
   * spinner for the heading. Every one of those hops pushed the largest paint
   * later, which is how /onboarding ended up at 3.4s.
   *
   * `isLoading` is true during the server render, so painting the real frame
   * in that state puts the wordmark, progress bar, "Class of" heading and the
   * year buttons into the static HTML — LCP now fires on HTML+CSS arrival,
   * before any network round trip. For a brand-new user (the common case) the
   * DOM is identical before and after auth resolves, so nothing shifts: no CLS.
   *
   * `flowActive` still gates the *writes*. Until the profile lands we don't
   * know which step the user belongs on, so we show step one read-only-ish:
   * the year buttons are tappable (local state only) but Continue stays
   * disabled and `saveSchoolYear` early-returns.
   *
   * Trade-off we accept: an unauthenticated or already-onboarded visitor
   * briefly sees the disabled first step before the effect above redirects
   * them. First paint for the many beats a spinner for the few.
   *
   * Edge case we accept: GRAD_YEARS is computed from `new Date()`, so the
   * prerendered HTML freezes the year list at build time. A build that
   * straddles New Year renders a stale first year until the next deploy —
   * a recoverable hydration mismatch, caught by the AuthGate Suspense
   * boundary, which React repairs by re-rendering on the client.
   */
  const visibleStep: OnboardingStep = flowActive ? step : 'school-year';
  const ready = flowActive;

  return (
    <div className="w-full max-w-md">
      <div className="mb-8">
        {/* Escape hatch: onboarding used to be a dead end — every route
            redirected back here and the only logout lived on /profile,
            which also redirected here. If saves fail, this link is the
            way out instead of "try logging in again" five times. */}
        <div className="flex items-start justify-between mb-6">
          {/* Shared Wordmark, not the old Bitcount "Temple / Parties" lockup:
              DESIGN.md retired Bitcount from header/nav, and it was pulling a
              419 KB variable TTF onto the onboarding critical path (TUP-15). */}
          <Link href="/">
            <Wordmark className="text-[28px]" />
          </Link>
          <button
            type="button"
            onClick={() => {
              void logout().then(() => router.replace('/login'));
            }}
            className="text-white/40 hover:text-white/70 text-xs font-montserrat underline underline-offset-2 transition-colors"
          >
            Sign out
          </button>
        </div>
        <div className="flex gap-1.5 mb-4">
          {ONBOARDING_STEPS.map((s, i) => (
            <div
              key={s}
              className={`h-1 flex-1 rounded-full ${
                i <= stepIndexOf(visibleStep) ? 'bg-[#b24bf3]' : 'bg-zinc-800'
              }`}
            />
          ))}
        </div>
      </div>

        {visibleStep === 'school-year' && (
          <form onSubmit={saveSchoolYear} className="space-y-5">
            <div>
              <h1 className="text-white text-2xl font-montserrat font-semibold">Class of</h1>
              <p className="text-white/60 text-sm font-montserrat mt-1">Required — helps hosts know the crowd. When do you walk?</p>
            </div>
            <div className="grid gap-2">
              {GRAD_YEARS.map((y) => (
                <button
                  key={y.value}
                  type="button"
                  onClick={() => setSchoolYear(y.value)}
                  className={`w-full text-left px-4 py-3 rounded-xl font-montserrat border transition-colors touch-manipulation ${
                    schoolYear === y.value
                      ? 'border-[#b24bf3] bg-[#b24bf3]/15 text-white'
                      : 'border-zinc-700 bg-zinc-900 text-white/80 hover:border-zinc-500'
                  }`}
                >
                  {y.label}
                </button>
              ))}
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button
              type="submit"
              disabled={!ready || !schoolYear || submitting}
              className="w-full py-3.5 rounded-xl font-montserrat font-semibold text-white bg-[#b24bf3] disabled:opacity-50 touch-manipulation"
            >
              {submitting ? 'Saving…' : 'Continue'}
            </button>
          </form>
        )}

        {visibleStep === 'username' && (
          <form onSubmit={saveUsername} className="space-y-5">
            <div>
              <h1 className="text-white text-2xl font-montserrat font-semibold">Choose a username</h1>
              <p className="text-white/60 text-sm font-montserrat mt-1">This is how others will see you.</p>
            </div>
            <div>
              <input
                type="text"
                autoFocus
                autoComplete="username"
                value={username}
                onChange={(e) => {
                  const v = e.target.value.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 30);
                  setUsername(v);
                  setError('');
                  runUsernameCheck(v);
                }}
                placeholder="owl_party"
                className="w-full px-4 py-3.5 bg-zinc-900 border border-zinc-700 rounded-xl text-white placeholder-white/40 font-montserrat focus:border-[#b24bf3] outline-none touch-manipulation"
              />
              <p
                className={`text-sm mt-2 font-montserrat ${
                  usernameStatus === 'available'
                    ? 'text-emerald-400'
                    : usernameStatus === 'taken' || usernameStatus === 'invalid'
                      ? 'text-red-400'
                      : 'text-white/40'
                }`}
              >
                {usernameHint}
              </p>
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button
              type="submit"
              /* Not gated on 'checking' (TUP-7): a valid-looking username is
                 submittable the instant it matches the pattern. Waiting on the
                 debounced lookup made Continue dead for ~350ms+ after the last
                 keystroke, which read as a broken button and drove rageclicks.
                 A name taken between check and save still fails server-side. */
              disabled={
                submitting ||
                !USERNAME_PATTERN.test(username.trim()) ||
                usernameStatus === 'taken'
              }
              className="w-full py-3.5 rounded-xl font-montserrat font-semibold text-white bg-[#b24bf3] disabled:opacity-50 touch-manipulation"
            >
              {submitting ? 'Saving…' : 'Continue'}
            </button>
          </form>
        )}

        {visibleStep === 'avatar' && (
          <form onSubmit={saveAvatar} className="space-y-5">
            <div>
              <h1 className="text-white text-2xl font-montserrat font-semibold">Profile picture</h1>
              <p className="text-white/60 text-sm font-montserrat mt-1">Optional — you can add one later.</p>
            </div>
            <div className="flex flex-col items-center gap-4">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-28 h-28 rounded-full bg-zinc-900 border border-zinc-700 overflow-hidden flex items-center justify-center text-white/50 font-montserrat text-sm hover:border-[#b24bf3] touch-manipulation"
              >
                {previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={previewUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  'Add photo'
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => void onPickAvatar(e.target.files?.[0] ?? null)}
              />
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 rounded-xl font-montserrat font-semibold text-white bg-[#b24bf3] disabled:opacity-50 touch-manipulation"
            >
              {submitting ? 'Uploading…' : 'Continue'}
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => goNext()}
              className="w-full py-2 text-sm font-montserrat text-white/50 hover:text-white touch-manipulation"
            >
              Skip for now
            </button>
          </form>
        )}

        {visibleStep === 'greek-life' && (
          <form onSubmit={saveGreek} className="space-y-5">
            <div>
              <h1 className="text-white text-2xl font-montserrat font-semibold">Greek life</h1>
              <p className="text-white/60 text-sm font-montserrat mt-1">Optional — chapter or org name.</p>
            </div>
            <input
              type="text"
              value={greekLife}
              onChange={(e) => setGreekLife(e.target.value.slice(0, 100))}
              placeholder="e.g. AEPi"
              className="w-full px-4 py-3.5 bg-zinc-900 border border-zinc-700 rounded-xl text-white placeholder-white/40 font-montserrat focus:border-[#b24bf3] outline-none touch-manipulation"
            />
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 rounded-xl font-montserrat font-semibold text-white bg-[#b24bf3] disabled:opacity-50 touch-manipulation"
            >
              {submitting ? 'Saving…' : 'Continue'}
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => goNext()}
              className="w-full py-2 text-sm font-montserrat text-white/50 hover:text-white touch-manipulation"
            >
              Skip for now
            </button>
          </form>
        )}

        {visibleStep === 'instagram' && (
          <form onSubmit={saveInstagram} className="space-y-5">
            <div>
              <h1 className="text-white text-2xl font-montserrat font-semibold">Instagram</h1>
              <p className="text-white/60 text-sm font-montserrat mt-1">Optional — just the handle.</p>
            </div>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 font-montserrat">@</span>
              <input
                type="text"
                value={instagram}
                onChange={(e) =>
                  setInstagram(e.target.value.replace(/[^a-zA-Z0-9._]/g, '').slice(0, 30))
                }
                placeholder="temple_owl"
                className="w-full pl-8 pr-4 py-3.5 bg-zinc-900 border border-zinc-700 rounded-xl text-white placeholder-white/40 font-montserrat focus:border-[#b24bf3] outline-none touch-manipulation"
              />
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 rounded-xl font-montserrat font-semibold text-white bg-[#b24bf3] disabled:opacity-50 touch-manipulation"
            >
              {submitting ? 'Finishing…' : 'Finish'}
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => void finishOnboarding()}
              className="w-full py-2 text-sm font-montserrat text-white/50 hover:text-white touch-manipulation"
            >
              Skip for now
            </button>
          </form>
        )}
      </div>
  );
}

/** FLOW 2 onboarding. Required: school year + username. Optional steps offer Skip. */
export default function OnboardingPage() {
  return (
    /* Top-anchored on mobile, centered only at sm+ (TUP-7).
       Vertical centering re-solves the layout every time the on-screen
       keyboard opens or closes — the username input autofocuses, and the
       Greek/Instagram inputs are tapped — so the whole form (Continue
       included) slid under the user's thumb mid-tap. Anchoring to the top
       pins the buttons in place; `min-h-dvh` tracks the *dynamic* viewport
       so mobile browser chrome collapsing doesn't resize the box either.
       Desktop has no soft keyboard, so it still centers at sm and up. */
    <main className="min-h-dvh bg-black flex items-start sm:items-center justify-center px-6 pt-12 pb-16 sm:py-12">
      <OnboardingFlow />
    </main>
  );
}
