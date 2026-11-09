'use client';

/**
 * HostRankingRow — one host on the Ranks tab, same card language as the
 * party rankings. Not a link — host profile pages don't exist yet.
 *
 * Ineligible hosts (<2 parties or <15 ratings) dim out with a dashed
 * percentage: their sample is too small to rank honestly.
 */

import { memo } from 'react';
import { HostRanking } from '@/lib/types';
import VoteArrow from '@/components/ui/VoteArrow';
import { rankColor } from './RankingRow';
// GoingStat — restore with attendance below when last-sem going data is real.

interface HostRankingRowProps {
  rank: number;
  host: HostRanking;
  isBelowThreshold?: boolean;
}

function HostRankingRow({ rank, host, isBelowThreshold }: HostRankingRowProps) {
  return (
    <article
      className={`flex items-center gap-4 bg-temple-surface-2 border border-white/10 rounded-[14px] px-4 py-3.5 mb-3 ${
        isBelowThreshold ? 'opacity-60' : ''
      }`}
    >
      <span className={`w-8 shrink-0 font-montserrat font-bold text-[22px] leading-none tabular-nums ${rankColor(rank)}`}>
        {rank}
      </span>

      <div className="flex-1 min-w-0">
        <p className="font-montserrat font-bold text-[15.5px] leading-5 text-white truncate">
          {host.displayName}
        </p>
        <p className="font-montserrat text-[12.5px] text-temple-muted truncate mt-1">
          {host.partiesHosted} {host.partiesHosted === 1 ? 'party' : 'parties'} hosted
        </p>
      </div>

      <div className="shrink-0 flex flex-col items-end gap-1.5">
        <span className="flex items-center gap-1 font-montserrat font-bold text-[14px] text-white">
          <VoteArrow direction="up" className="w-[15px] h-[15px]" />
          {isBelowThreshold ? '—' : `${Math.round(host.avgLikePercentage)}%`}
          <span className="font-medium text-[12px] text-temple-muted">({host.totalRatingCount})</span>
        </span>
        {/* Attendance hidden: last-sem going_count was zeroed when RSVPs
            became party_going-only. Restore GoingStat when that data is real.
        <GoingStat count={host.totalGoingCount} />
        */}
      </div>
    </article>
  );
}

export default memo(HostRankingRow);
