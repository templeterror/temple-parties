'use client';

import BottomNav from '@/components/BottomNav';
import { HostTonightPromptSheet } from '@/components/HostTonightPrompt';
import useHostTonightPrompt from '@/hooks/useHostTonightPrompt';
import { HomeReselectProvider } from '@/contexts/HomeReselectContext';

/**
 * Attendee chrome: bottom/desktop nav around routed pages.
 * Auth/onboarding/admin/demo keep their own layouts (no shell).
 *
 * hideBottomNav is for "pushed" routes like the party page, and for the map
 * while a pin drawer is open: they trade the mobile Dock for their own
 * bottom chrome. Desktop keeps the top bar either way — big screens always
 * have chrome to spare. HostTonightPrompt mounts here (Home only; hosts
 * daily Wed–Sat, regulars Friday) and replaces the mobile Dock while
 * the sheet is up, same as PartySheet on the map.
 *
 * Pages that scroll pad their bottom with `pb-[var(--dock-clearance)]` so
 * nothing ends under the floating Dock. HomeReselectProvider lets the Dock's
 * Home-on-Home tap reach the page (PartyDeck → back to #1).
 */
export default function AppShell({
  children,
  mapMode = false,
  hideBottomNav = false,
}: {
  children: React.ReactNode;
  /** Map needs a locked viewport height; other pages scroll. */
  mapMode?: boolean;
  /** Suppress the mobile Dock (party page, or map while a pin drawer is open). */
  hideBottomNav?: boolean;
}) {
  const prompt = useHostTonightPrompt();

  return (
    <HomeReselectProvider>
      <main
        className={`min-h-screen bg-black lg:pt-16 ${
          mapMode ? 'h-screen overflow-hidden' : ''
        }`}
      >
        {children}
        {!mapMode && <HostTonightPromptSheet {...prompt} />}
        <BottomNav desktopOnly={hideBottomNav || prompt.visible} />
      </main>
    </HomeReselectProvider>
  );
}
