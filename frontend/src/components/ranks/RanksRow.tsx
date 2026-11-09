'use client';

/**
 * RanksPartyRow / RanksHostRow — one entry below the podium (#4 onward, and
 * the "not ranked yet" group).
 *
 * Bare rows on black, no card: the podium's plinths are the page's one
 * raised surface, and between rows the job is separation, not elevation —
 * so `RanksList` draws hairlines instead (emil-surfaces; "hierarchy is
 * subtraction", ranks-audit.md).
 *
 * Anatomy, left → right:
 *   rank numeral (20px bold, white, tabular — legible at every position;
 *   blank when unranked) · 44px thumb (party flyer 4:5 / host logo or
 *   monogram disc, 1px white/10 outline) · title (host's own casing, 2-line
 *   clamp, balanced) over `host · date` or `N parties hosted` · score
 *   (`91%` over `64 votes`; the % goes muted when unranked).
 *
 * Unranked rows are NOT opacity-dimmed (fails contrast unpredictably); the
 * group they sit in says why they have no rank.
 *
 * Party rows link to the party page (demo-aware via usePartyHref) and the
 * link's aria-label speaks the whole row in one breath. Host rows aren't
 * links — no public host page yet.
 */

import Image from 'next/image';
import Link from 'next/link';
import { DECK_FOCUS_RING } from '@/components/feed/RankStrip';
import { usePartyHref } from '@/contexts/DemoModeContext';
import type { HostRanking, PartyRanking } from '@/lib/types';
import { formatShortDate } from '@/utils/dateHelpers';
import { formatLikePct, monogram, partiesHostedLabel, posterInitials, votesLabel } from '@/utils/ranks';

// ─── Party ───────────────────────────────────────────────────────────────────

interface RanksPartyRowProps {
  party: PartyRanking;
  /** 1-based rank; null when under the vote floor. */
  rank: number | null;
}

export function RanksPartyRow({ party, rank }: RanksPartyRowProps) {
  const href = usePartyHref(party.id);
  const pct = formatLikePct(party.likePercentage);
  const dateLabel = party.date ? formatShortDate(party.date) : '';
  const spokenRank = rank != null ? `#${rank}: ` : '';
  const spokenDate = dateLabel ? `, ${dateLabel}` : '';

  return (
    <Link
      href={href}
      aria-label={`${spokenRank}${party.title}, by ${party.host}${spokenDate}, ${pct} liked, ${votesLabel(party.ratingCount)}`}
      // -mx-2 + px-2: the hover/press surface bleeds past the text column.
      className={`ranks__press -mx-2 flex min-h-[44px] items-center gap-3 rounded-[10px] px-2 py-3 hover:bg-temple-surface ${DECK_FOCUS_RING}`}
    >
      <RankNumeral rank={rank} />
      <span className="relative block aspect-[4/5] w-11 shrink-0 overflow-hidden rounded-[6px] bg-temple-surface-2 outline outline-1 -outline-offset-1 outline-white/10">
        {party.posterImage ? (
          <Image src={party.posterImage} alt="" fill sizes="44px" className="object-cover" />
        ) : (
          <span
            aria-hidden
            className="absolute inset-0 flex items-center justify-center text-[14px] font-bold text-temple-purple-light"
          >
            {posterInitials(party.title)}
          </span>
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 text-balance text-[15px] font-bold leading-[19px]">{party.title}</span>
        <span className="mt-1 flex min-w-0 items-center gap-1 text-[13px] leading-4">
          <span className="truncate text-temple-purple-light">{party.host}</span>
          {dateLabel && (
            <span className="shrink-0 whitespace-nowrap text-temple-muted">
              <span aria-hidden>· </span>
              {dateLabel}
            </span>
          )}
        </span>
      </span>
      <RankScore pct={pct} votes={party.ratingCount} muted={rank == null} />
    </Link>
  );
}

// ─── Host ────────────────────────────────────────────────────────────────────

interface RanksHostRowProps {
  host: HostRanking;
  /** 1-based rank among eligible hosts; null when ineligible. */
  rank: number | null;
}

export function RanksHostRow({ host, rank }: RanksHostRowProps) {
  return (
    <div className="flex min-h-[44px] items-center gap-3 py-3">
      <RankNumeral rank={rank} />
      <span className="relative flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-temple-surface-2 outline outline-1 -outline-offset-1 outline-white/10">
        {host.logoUrl ? (
          // Plain <img>: logos can be any origin.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={host.logoUrl} alt="" className="absolute inset-0 size-full object-cover" />
        ) : (
          <span aria-hidden className="text-[14px] font-bold text-temple-purple-light">
            {monogram(host.displayName)}
          </span>
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 text-balance text-[15px] font-bold leading-[19px]">
          {rank != null && <span className="sr-only">#{rank}: </span>}
          {host.displayName}
        </span>
        <span className="mt-1 block text-[13px] leading-4 text-temple-muted tabular-nums">
          {partiesHostedLabel(host.partiesHosted)}
        </span>
      </span>
      <RankScore pct={formatLikePct(host.avgLikePercentage)} votes={host.totalRatingCount} muted={rank == null} />
    </div>
  );
}

// ─── Pieces ──────────────────────────────────────────────────────────────────

/** Visual only — the row's label (or sr-only prefix) speaks the rank. */
function RankNumeral({ rank }: { rank: number | null }) {
  return (
    <span aria-hidden className="w-7 shrink-0 text-right text-[20px] font-bold leading-none tabular-nums">
      {rank ?? ''}
    </span>
  );
}

/** `91%` over `64 votes` — the sample size always sits under the score. */
function RankScore({ pct, votes, muted }: { pct: string; votes: number; muted: boolean }) {
  return (
    <span className="shrink-0 text-right tabular-nums">
      <span className={`block text-[15px] font-bold leading-5 ${muted ? 'text-temple-muted' : ''}`}>{pct}</span>
      <span className="block whitespace-nowrap text-[12px] leading-4 text-temple-muted">{votesLabel(votes)}</span>
    </span>
  );
}
