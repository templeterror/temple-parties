'use client';

/**
 * RankingRow — one party on the Ranks tab, as a card in the feed language.
 *
 * The whole card links to the party's detail page. Rank numbers medal:
 * #1 wears the hyped gold, #2 light purple, #3 purple, the rest stay quiet.
 * Below the 5-rating threshold the card dims and the percentage shows a
 * dash — a score built on two votes isn't a score.
 */

import Link from 'next/link';
import { memo } from 'react';
import { PartyRanking } from '@/lib/types';
import { formatShortDate } from '@/utils/dateHelpers';
import VoteArrow from '@/components/ui/VoteArrow';
import { usePartyHref } from '@/contexts/DemoModeContext';

/** Medal colors for the podium ranks; everyone else stays muted. */
export function rankColor(rank: number): string {
  if (rank === 1) return 'text-temple-hyped';
  if (rank === 2) return 'text-temple-purple-light';
  if (rank === 3) return 'text-temple-purple';
  return 'text-white/30';
}

/** Small "people going" readout shared by both ranking cards. */
export function GoingStat({ count }: { count: number }) {
  return (
    <span className="flex items-center justify-end gap-1 font-montserrat text-[12px] text-temple-muted">
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
        />
      </svg>
      {count}
    </span>
  );
}

interface RankingRowProps {
  rank: number;
  party: PartyRanking;
  isBelowThreshold?: boolean;
}

function RankingRow({ rank, party, isBelowThreshold }: RankingRowProps) {
  const detailHref = usePartyHref(party.id);
  return (
    <Link href={detailHref} className="block mb-3">
      <article
        className={`flex items-center gap-4 bg-temple-surface-2 border border-white/10 rounded-[14px] px-4 py-3.5 transition-colors hover:border-white/20 ${
          isBelowThreshold ? 'opacity-60' : ''
        }`}
      >
        <span className={`w-8 shrink-0 font-montserrat font-bold text-[22px] leading-none ${rankColor(rank)}`}>
          {rank}
        </span>

        <div className="flex-1 min-w-0">
          <p className="font-montserrat font-bold text-[15.5px] leading-5 text-white truncate">
            {party.title}
          </p>
          <p className="font-montserrat text-[12.5px] text-temple-purple-light truncate mt-1">
            by {party.host}
            {party.date && <span className="text-temple-muted"> · {formatShortDate(party.date)}</span>}
          </p>
        </div>

        <div className="shrink-0 flex flex-col items-end gap-1.5">
          <span className="flex items-center gap-1 font-montserrat font-bold text-[14px] text-white">
            <VoteArrow direction="up" className="w-[15px] h-[15px]" />
            {isBelowThreshold ? '—' : `${Math.round(party.likePercentage)}%`}
            <span className="font-medium text-[12px] text-temple-muted">({party.ratingCount})</span>
          </span>
          <GoingStat count={party.goingCount} />
        </div>
      </article>
    </Link>
  );
}

export default memo(RankingRow);
