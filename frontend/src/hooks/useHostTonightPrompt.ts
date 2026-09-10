'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import {
  hostTonightBody,
  hostTonightCadence,
  hostTonightHref,
  isHostTonightForceParam,
  lookingCountForWindow,
  markHostTonightConsumed,
  markHostTonightRevealed,
  readHostTonightConsumed,
  readHostTonightRevealed,
  shouldShowHostTonightPrompt,
  type HostTonightHref,
} from '@/lib/hostTonightPrompt';
import { trackEvent } from '@/utils/analytics';

const ENTER_DELAY_MS = 1100;

export default function useHostTonightPrompt(): {
  visible: boolean;
  href: HostTonightHref;
  isHost: boolean;
  body: string;
  dismiss: () => void;
  onCta: () => void;
} {
  const pathname = usePathname() ?? '/';
  const { user, isLoading, isAuthenticated } = useAuth();
  const [visible, setVisible] = useState(false);
  const [storageKey, setStorageKey] = useState<string | null>(null);
  const [body, setBody] = useState('');

  const isHost = !!(user?.isHost || user?.isAdmin);
  const href = hostTonightHref(user);

  useEffect(() => {
    if (isLoading) return;

    const force =
      typeof window !== 'undefined' && isHostTonightForceParam(window.location.search);
    // AuthGate walls the live app; don't animate or count a prompt under it.
    // `?host_prompt=1` is the QA override and skips this so we can screenshot.
    if (!isAuthenticated && !force) return;
    const decision = shouldShowHostTonightPrompt({
      pathname,
      force,
      isHost,
      userId: user?.id ?? null,
      consumedKeys: readHostTonightConsumed(),
    });

    if (!decision.show) {
      setVisible(false);
      setStorageKey(null);
      setBody('');
      return;
    }

    setStorageKey(decision.storageKey);
    const count = lookingCountForWindow(decision.storageKey);
    setBody(hostTonightBody(count));
    const alreadyRevealed = readHostTonightRevealed() === decision.storageKey;
    const reduceMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const delay = alreadyRevealed || reduceMotion ? 0 : ENTER_DELAY_MS;

    const timer = window.setTimeout(() => {
      markHostTonightConsumed(decision.storageKey);
      markHostTonightRevealed(decision.storageKey);
      setVisible(true);
      if (!alreadyRevealed) {
        trackEvent('host_tonight_prompt_shown', {
          isHost,
          forced: force,
          lookingCount: count,
          cadence: hostTonightCadence(isHost),
        });
      }
    }, delay);

    return () => window.clearTimeout(timer);
  }, [isLoading, isAuthenticated, pathname, isHost, user?.id]);

  const dismiss = useCallback(() => {
    if (storageKey) markHostTonightConsumed(storageKey);
    setVisible(false);
    trackEvent('host_tonight_prompt_dismissed', { isHost });
  }, [storageKey, isHost]);

  const onCta = useCallback(() => {
    if (storageKey) markHostTonightConsumed(storageKey);
    setVisible(false);
    trackEvent('host_tonight_prompt_clicked', { isHost, href });
  }, [storageKey, isHost, href]);

  return { visible, href, isHost, body, dismiss, onCta };
}
