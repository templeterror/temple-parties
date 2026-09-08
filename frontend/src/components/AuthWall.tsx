'use client';

import { useEffect, useMemo, useRef } from 'react';
import { usePathname } from 'next/navigation';
import LoginPanel from '@/components/LoginPanel';
import Wordmark from '@/components/ui/Wordmark';
import { loginPitch, sanitizeNextPath } from '@/lib/authHelpers';
import { peekPendingAuthAction } from '@/lib/pendingAuthAction';

/**
 * Hard gate: the live app stays visible as atmosphere (blurred, inert) so
 * the weekend feels close — the sheet is the only thing you can touch.
 *
 * Overlay uses backdrop-filter rather than filtering the page itself so
 * Leaflet maps keep their transform context (same reason StagePoster blurs
 * a static img, not the map).
 *
 * nextPath is read from window.location, not useSearchParams — that hook
 * suspends, and AuthGate's Suspense fallback used to dump the live app
 * unwalled (e.g. /leaderboards).
 */
export default function AuthWall({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '/';
  const lockedRef = useRef<HTMLDivElement>(null);

  const nextPath = useMemo(() => {
    if (typeof window === 'undefined') return sanitizeNextPath(pathname);
    return sanitizeNextPath(`${window.location.pathname}${window.location.search}`);
  }, [pathname]);

  const pitch = useMemo(
    () => loginPitch(nextPath, peekPendingAuthAction()?.type ?? null),
    [nextPath]
  );

  useEffect(() => {
    const node = lockedRef.current;
    if (node) node.setAttribute('inert', '');
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      node?.removeAttribute('inert');
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return (
    <div className="relative min-h-screen">
      <div ref={lockedRef} aria-hidden="true" className="pointer-events-none select-none">
        {children}
      </div>

      <div
        className="fixed inset-0 flex items-end justify-center lg:items-center px-0 lg:px-6"
        style={{ zIndex: 10050 }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-wall-title"
      >
        <div
          className="absolute inset-0 bg-black/55 backdrop-blur-[10px]"
          aria-hidden="true"
        />
        <div
          className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,_rgba(178,75,243,0.22),_transparent_58%)]"
          aria-hidden="true"
        />

        <div className="relative w-full min-w-0 max-w-full overflow-hidden sm:max-w-md lg:max-w-sm bg-temple-surface-2 border border-white/10 rounded-t-[20px] lg:rounded-2xl px-6 pt-7 pb-[max(1.5rem,env(safe-area-inset-bottom))] lg:py-8 animate-slide-up-fade shadow-[0_-12px_40px_rgba(0,0,0,0.45)]">
          <div className="text-center">
            <Wordmark className="text-[22px]" />
            <h1
              id="auth-wall-title"
              className="text-white text-[22px] leading-7 font-semibold font-montserrat mt-5 text-balance"
            >
              {pitch.title}
            </h1>
            <p className="text-white/60 font-montserrat text-sm mt-2 leading-relaxed">
              {pitch.body}
            </p>
          </div>

          <div className="mt-6">
            <LoginPanel nextPath={nextPath} />
          </div>
        </div>
      </div>
    </div>
  );
}
