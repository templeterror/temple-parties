'use client';

/**
 * RanksSkeleton — the Ranks page's loading shape: the podium's footprint
 * (same grid, same 4:5 flyers, same plinth heights, same caption slot) and
 * a few list rows (numeral · 44px thumb · two text lines · score).
 *
 * Replaces the old centred spinner (ranks-audit.md): a skeleton holds the
 * layout, so the podium rises into the space it already occupies instead
 * of the page collapsing and re-expanding on every period change.
 * Decorative (aria-hidden); the parent marks the region aria-busy.
 */

import { RanksGhostPodium } from './RanksPodium';

const BLOCK = 'bg-temple-surface';

export default function RanksSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div aria-hidden className="mt-4">
      <RanksGhostPodium pulse />
      <div className="mt-6 animate-pulse">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-3 py-3">
            <span className="w-7 shrink-0" />
            <span className={`aspect-[4/5] w-11 shrink-0 rounded-[6px] ${BLOCK}`} />
            <span className="min-w-0 flex-1">
              <span className={`block h-4 w-3/4 rounded ${BLOCK}`} />
              <span className={`mt-2 block h-3 w-1/2 rounded ${BLOCK}`} />
            </span>
            <span className={`h-9 w-12 shrink-0 rounded ${BLOCK}`} />
          </div>
        ))}
      </div>
    </div>
  );
}
