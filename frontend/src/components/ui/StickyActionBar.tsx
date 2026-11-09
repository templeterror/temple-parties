/**
 * StickyActionBar — the fixed bar pinned to the bottom of the party page
 * holding its actions (components/party/PartyActionBar: the one primary —
 * I'm going or Buy tickets — plus directions and share).
 *
 * "Sticky" here means position:fixed — the actions stay reachable no matter
 * how far you scroll. Pages that render it must pad their own bottom
 * (pb-28 or more) so the last content isn't hidden underneath it.
 *
 * Layering: z-9000 keeps it above page content but below BottomNav (9999)
 * and modals (ModalWrapper is 10000) — a modal must always cover the bar.
 * The pb-[max(...)] handles the iPhone home-indicator area: on notched
 * phones env(safe-area-inset-bottom) is ~34px, elsewhere it's 0, so we take
 * whichever is bigger.
 */

import type { ReactNode } from 'react';

export default function StickyActionBar({ children }: { children: ReactNode }) {
  return (
    <div className="fixed bottom-0 inset-x-0 bg-temple-surface border-t border-white/10" style={{ zIndex: 9000 }}>
      <div className="max-w-xl mx-auto flex items-center gap-2.5 px-4 pt-3.5 pb-[max(14px,env(safe-area-inset-bottom))]">
        {children}
      </div>
    </div>
  );
}
