'use client';

/**
 * RankChampionCard — the #1 party's hero treatment at the top of the Ranks
 * page. The champion doesn't sit in the list; it gets the stage: its flyer
 * on the cinema blur-wings, a gold "#1" chip naming the period it won
 * ("#1 · THIS SEMESTER"), and its numbers writ large.
 *
 * Whole card links to the party page (no in-card actions here, so a plain
 * Link wrapper is safe — nothing interactive gets nested).
 */

import Link from 'next/link';
import { memo } from 'react';
import { PartyRanking } from '@/lib/types';
import { formatShortDate } from '@/utils/dateHelpers';
import StagePoster from '@/components/ui/StagePoster';
import Pill from '@/components/ui/Pill';
import VoteArrow from '@/components/ui/VoteArrow';
import { GoingStat } from './RankingRow';
import { usePartyHref } from '@/contexts/DemoModeContext';

interface RankChampionCardProps {
  party: PartyRanking;
  /** Which crown this is — "LAST WEEKEND", "THIS MONTH", "THIS SEMESTER". */
  periodLabel: string;
}

function RankChampionCard({ party, periodLabel }: RankChampionCardProps) {
  const detailHref = usePartyHref(party.id);
  return (
    <Link href={detailHref} className="block mb-3">
      <article className="bg-temple-surface-2 border border-white/10 rounded-2xl overflow-hidden animate-slide-up-fade transition-colors hover:border-white/20">
        <StagePoster src={party.posterImage ?? undefined} title={party.title} heightClass="h-[280px]" priority />

        <div className="flex flex-col gap-2 px-3.5 pt-3 pb-3.5">
          <div className="flex items-center justify-between gap-2">
            <Pill tone="hyped" size="sm" shape="square" title={`Top party, ${periodLabel.toLowerCase()}`}>
              #1 · {periodLabel}
            </Pill>
            <span className="text-temple-muted" aria-hidden>
              <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4">
                <path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </div>

          <h2 className="font-montserrat font-bold text-[22px] leading-[26px] text-white uppercase truncate">
            {party.title}
          </h2>

          <div className="flex items-center justify-between gap-3">
            <p className="min-w-0 font-montserrat text-[13.5px] text-temple-purple-light truncate">
              by {party.host}
              {party.date && <span className="text-temple-muted"> · {formatShortDate(party.date)}</span>}
            </p>
            <div className="shrink-0 flex items-center gap-3">
              <span className="flex items-center gap-1 font-montserrat font-bold text-[15px] text-white">
                <VoteArrow direction="up" className="w-4 h-4" />
                {Math.round(party.likePercentage)}%
                <span className="font-medium text-[12.5px] text-temple-muted">({party.ratingCount})</span>
              </span>
              <GoingStat count={party.goingCount} />
            </div>
          </div>
        </div>
      </article>
    </Link>
  );
}

export default memo(RankChampionCard);
