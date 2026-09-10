'use client';

import BottomNav from '@/components/BottomNav';
import { HostTonightPromptSheet } from '@/components/HostTonightPrompt';
import useHostTonightPrompt from '@/hooks/useHostTonightPrompt';

/**
 * Attendee chrome: bottom/desktop nav around routed pages.
 * Auth/onboarding/admin/demo keep their own layouts (no shell).
 *
 * hideBottomNav is for "pushed" routes like the party page, and for the map
 * while a pin drawer is open: they trade the mobile tab bar for their own
 * bottom chrome. Desktop keeps the top bar either way — big screens always
 * have chrome to spare. HostTonightPrompt mounts here (Home only; hosts
 * daily Wed–Sat, regulars Friday) and replaces the mobile tab bar while
 * the sheet is up, same as PartySheet on the map.
 */
export default function AppShell({
  children,
  mapMode = false,
  hideBottomNav = false,
}: {
  children: React.ReactNode;
  /** Map needs a locked viewport height; other pages scroll. */
  mapMode?: boolean;
  /** Suppress the mobile tab bar (party page, or map while a pin drawer is open). */
  hideBottomNav?: boolean;
}) {
  const prompt = useHostTonightPrompt();

  return (
    <main
      className={`min-h-screen bg-black lg:pt-16 ${
        mapMode ? 'h-screen overflow-hidden' : ''
      }`}
    >
      {children}
      {!mapMode && <HostTonightPromptSheet {...prompt} />}
      <BottomNav desktopOnly={hideBottomNav || prompt.visible} />
    </main>
  );
}
