'use client';

/**
 * RanksPodium — the top three of a ranking, standing on a podium.
 *
 * #1 in the centre on the tallest step (its column ≈40% of the width), #2
 * left, #3 right. Each step is the party's whole flyer at 4:5
 * (`object-contain`, letterbox space above, so the art stands ON the step)
 * or, for hosts, a round logo / monogram plate. Steps are quiet
 * `temple-surface` plinths carrying a white numeral; all plinths share one
 * baseline and every caption reserves a 2-line title, so the three line up
 * although the steps differ in height. #1 gets the Quiet eyebrow
 * ("#1 last weekend", "#1 host") in hyped yellow TEXT — no box, no glow
 * (the app's one glow stays on the HEADLINER badge).
 *
 * Composition: the stage takes its steps as children, already in visual
 * order (`podiumOrder` in utils/ranks.ts → 2 · 1 · 3). DOM order = visual
 * order, so Tab and screen readers go left to right like the eye; each
 * step announces its own rank. Key the stage by period so the rise replays.
 *
 *   <RanksPodium count={top.length} aria-label="Top 3, last weekend" key={period}>
 *     {podiumOrder(top).map((p) => (
 *       <RanksPodiumPartyStep key={p.id} party={p} rank={…} eyebrow="#1 last weekend" />
 *     ))}
 *   </RanksPodium>
 *
 * Party steps are links to the party page (demo-aware via usePartyHref);
 * host steps are not links — there is no public host page yet.
 *
 * Motion (globals.css "Ranks"): steps rise #3 → #2 → #1, 200ms, 40ms apart,
 * strong ease-out; press scales 0.97; both off under reduced motion.
 */

import Image from 'next/image';
import Link from 'next/link';
import { forwardRef, type ComponentPropsWithoutRef, type CSSProperties } from 'react';
import { DECK_FOCUS_RING } from '@/components/feed/RankStrip';
import { usePartyHref } from '@/contexts/DemoModeContext';
import type { HostRanking, PartyRanking } from '@/lib/types';
import { formatLikePct, monogram, posterWord, votesLabel } from '@/utils/ranks';

// ─── Stage ───────────────────────────────────────────────────────────────────

interface RanksPodiumProps extends ComponentPropsWithoutRef<'section'> {
  /** How many steps (1–3) — picks the grid columns. */
  count: number;
}

/** The podium grid. Pass an `aria-label` ("Top 3, last weekend"). */
const RanksPodium = forwardRef<HTMLElement, RanksPodiumProps>(function RanksPodium(
  { count, className = '', children, ...props },
  ref,
) {
  return (
    <section ref={ref} {...props} className={`ranks-podium ${className}`} data-count={count}>
      {children}
    </section>
  );
});

export default RanksPodium;

// ─── Party step ──────────────────────────────────────────────────────────────

interface RanksPodiumPartyStepProps {
  party: PartyRanking;
  /** 1, 2 or 3. */
  rank: number;
  /** #1's eyebrow, period-aware ("#1 last weekend"). Unused on #2/#3. */
  eyebrow: string;
}

export function RanksPodiumPartyStep({ party, rank, eyebrow }: RanksPodiumPartyStepProps) {
  const href = usePartyHref(party.id);
  const pct = formatLikePct(party.likePercentage);
  const champion = rank === 1;

  return (
    <Link
      href={href}
      aria-label={`${champion ? eyebrow : `#${rank}`}: ${party.title}, by ${party.host}, ${pct} liked, ${votesLabel(party.ratingCount)}`}
      className={`ranks-podium__step ranks__press group rounded-lg ${DECK_FOCUS_RING}`}
      data-rank={rank}
    >
      <span className="ranks-podium__figure">
        {champion && <Eyebrow>{eyebrow}</Eyebrow>}
        <span className="ranks-podium__flyer relative block aspect-[4/5] w-full">
          {party.posterImage ? (
            <Image
              src={party.posterImage}
              alt=""
              fill
              sizes={champion ? '(min-width: 1024px) 224px, 40vw' : '(min-width: 1024px) 168px, 30vw'}
              priority={champion}
              // Above the fold: all three load eagerly, #1 with priority.
              loading={champion ? undefined : 'eager'}
              // Whole flyer, standing on its step: letterbox space goes above.
              className="object-contain object-bottom"
            />
          ) : (
            <WordTile title={party.title} />
          )}
        </span>
        <Plinth rank={rank} />
      </span>
      <StepCaption title={party.title} pct={pct} votes={party.ratingCount} champion={champion} />
    </Link>
  );
}

// ─── Host step ───────────────────────────────────────────────────────────────

interface RanksPodiumHostStepProps {
  host: HostRanking;
  rank: number;
  /** #1's eyebrow. Defaults to "#1 host". */
  eyebrow?: string;
}

export function RanksPodiumHostStep({ host, rank, eyebrow = '#1 host' }: RanksPodiumHostStepProps) {
  const champion = rank === 1;
  return (
    // Not a link (no host page yet), so no press feedback either.
    <div className="ranks-podium__step" data-rank={rank}>
      <span className="ranks-podium__figure">
        {champion && <Eyebrow>{eyebrow}</Eyebrow>}
        <span className="ranks-podium__disc relative flex aspect-square items-center justify-center overflow-hidden rounded-full bg-temple-surface-2 outline outline-1 -outline-offset-1 outline-white/10">
          {host.logoUrl ? (
            // Plain <img>: host logos can come
            // from any origin, which next/image would refuse.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={host.logoUrl} alt="" className="absolute inset-0 size-full object-cover" />
          ) : (
            <span aria-hidden className="ranks-podium__monogram font-bold text-temple-purple-light">
              {monogram(host.displayName)}
            </span>
          )}
        </span>
        <Plinth rank={rank} />
      </span>
      <StepCaption
        title={host.displayName}
        pct={formatLikePct(host.avgLikePercentage)}
        votes={host.totalRatingCount}
        champion={champion}
        srPrefix={champion ? `${eyebrow}: ` : `#${rank}: `}
      />
    </div>
  );
}

// ─── Ghost podium (empty / skeleton footprint) ───────────────────────────────

/**
 * Three empty steps in the filled podium's exact footprint, so an empty
 * period (and the loading skeleton) keeps the page's shape. Decorative.
 * `pulse` = loading shimmer; otherwise the numerals show, muted.
 */
export function RanksGhostPodium({ pulse = false }: { pulse?: boolean }) {
  return (
    <div aria-hidden className={`ranks-podium ranks-podium--ghost ${pulse ? 'animate-pulse' : ''}`} data-count={3}>
      {[2, 1, 3].map((rank) => (
        <div key={rank} className="ranks-podium__step" data-rank={rank}>
          <span className="ranks-podium__figure">
            <span
              className={`ranks-podium__flyer block aspect-[4/5] w-full rounded-md ${
                pulse ? 'bg-temple-surface' : 'ring-1 ring-inset ring-temple-surface-2'
              }`}
            />
            <span className="ranks-podium__plinth mt-2 rounded-t-lg bg-temple-surface" data-rank={rank}>
              {!pulse && (
                <span className="ranks-podium__numeral font-bold leading-none text-temple-muted tabular-nums">
                  {rank}
                </span>
              )}
            </span>
          </span>
          {pulse && (
            // Caption footprint: 2-line title slot + % + votes.
            <span className="ranks-podium__caption flex flex-col items-center gap-1.5">
              <span className="h-[38px] w-4/5 rounded bg-temple-surface" />
              <span className="h-9 w-10 rounded bg-temple-surface" />
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Pieces ──────────────────────────────────────────────────────────────────

/** Visual only: party links speak it in aria-label, host steps in srPrefix. */
function Eyebrow({ children }: { children: string }) {
  return (
    <span aria-hidden className="mb-2 block whitespace-nowrap text-center text-[12px] font-bold uppercase leading-4 tracking-[0.08em] text-temple-hyped">
      {children}
    </span>
  );
}

/** The step itself: height = rank (globals.css), white numeral ≈17:1. */
function Plinth({ rank }: { rank: number }) {
  return (
    <span
      aria-hidden
      className="ranks-podium__plinth mt-2 rounded-t-lg bg-temple-surface ring-1 ring-inset ring-white/[0.06]"
      data-rank={rank}
    >
      <span className="ranks-podium__numeral font-bold leading-none tabular-nums">{rank}</span>
    </span>
  );
}

function StepCaption({
  title,
  pct,
  votes,
  champion,
  srPrefix,
}: {
  title: string;
  pct: string;
  votes: number;
  champion: boolean;
  /** Spoken rank for non-link steps (links carry it in aria-label). */
  srPrefix?: string;
}) {
  return (
    <span className="ranks-podium__caption">
      <span
        className={`ranks-podium__title line-clamp-2 text-balance font-bold ${
          champion ? 'text-[15px] leading-[19px]' : 'text-[13px] leading-[17px]'
        }`}
      >
        {srPrefix && <span className="sr-only">{srPrefix}</span>}
        {title}
      </span>
      <span className="mt-1.5 block text-[15px] font-bold leading-5 tabular-nums">{pct}</span>
      <span className="block text-[12px] leading-4 text-temple-muted tabular-nums">{votesLabel(votes)}</span>
    </span>
  );
}

/** No-poster flyer: the title's first real word as type, sized to the frame. */
function WordTile({ title }: { title: string }) {
  const word = posterWord(title);
  return (
    <span
      aria-hidden
      className="ranks-podium__wordtile absolute inset-0 flex items-end overflow-hidden rounded-md bg-temple-surface-2 p-2 font-bold leading-[0.95] text-temple-purple-light outline outline-1 -outline-offset-1 outline-white/10"
      style={{ '--ranks-word-len': Math.max(word.length, 3) } as CSSProperties}
    >
      {word}
    </span>
  );
}
