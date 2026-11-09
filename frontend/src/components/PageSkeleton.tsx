'use client';

import PartyDeckSkeleton from '@/components/feed/PartyDeckSkeleton';

/**
 * Per-page hydration gate — replaces the v1 whole-SPA pulse.
 * `deck` = Home: header + day tabs + the PartyDeck's shape.
 */
export default function PageSkeleton({ deck = false }: { deck?: boolean }) {
  if (deck) {
    return (
      <div className="pb-[var(--dock-clearance)] lg:pb-8">
        <div className="animate-pulse">
          {/* Header is pt-10 + 24px line + pb-2 = 76px, mobile only. */}
          <div className="h-[76px] lg:hidden" />
          <div className="max-w-xl mx-auto px-4 py-3 lg:max-w-3xl lg:px-8">
            <div className="h-11 bg-zinc-900/50 rounded-xl" />
          </div>
        </div>
        <PartyDeckSkeleton />
      </div>
    );
  }

  return (
    <div className="animate-pulse">
      <div className="h-14 bg-zinc-900/50 lg:hidden" />
      <div className="max-w-xl mx-auto px-4 py-3">
        <div className="h-11 bg-zinc-900/50 rounded-xl" />
        <div className="mt-3 h-[438px] bg-zinc-900/50 rounded-2xl" />
        <div className="mt-4 h-3 w-32 bg-zinc-900/50 rounded" />
        <div className="mt-3 space-y-3">
          <div className="h-[121px] bg-zinc-900/50 rounded-[14px]" />
          <div className="h-[121px] bg-zinc-900/50 rounded-[14px]" />
        </div>
      </div>
    </div>
  );
}
