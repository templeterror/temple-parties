/**
 * PartyStage — the top of the party page: the whole flyer on blurred wings
 * of itself, with the 44px back disc floating over it.
 *
 * The DeckCard's hero, grown to the viewport (≤ 60svh, see the "Party page"
 * section of globals.css): the flyer is `object-contain` — never cropped —
 * and bottom-aligned so it meets the title; spare height goes to the wings
 * up top, under the back disc. The wings are the same flyer at a 96px
 * rendition, scaled and blurred ONCE (a static CSS filter, never
 * backdrop-filter — DESIGN.md rule 3), masked so they fade into the black
 * page with no seam. No flyer → the Deck's typographic tile: the title as
 * texture on `temple-surface`, not a fake poster.
 *
 * Back always goes to a fixed place (home, or /demo), never history.back():
 * after login or a Safari restore the previous entry can be this same party,
 * and back() would strand you here.
 */

import Image from 'next/image';
import Link from 'next/link';
import { DECK_FOCUS_RING } from '@/components/feed/RankStrip';
import { BackIcon } from './PartyIcons';

interface PartyStageProps {
  posterImage?: string | null;
  title: string;
  /** Where the back disc lands. Live page → `/`; demo → `/demo`. */
  backHref: string;
}

/**
 * No-flyer tile type size — DeckCard's rule (as big as the longest word
 * allows on one line, ~0.75em per bold caps glyph) on the page's wider
 * ~330px column, so a word never breaks mid-way.
 */
function tileFontSize(title: string): number {
  const longest = Math.max(...title.split(/\s+/).map((w) => w.length), 1);
  return Math.round(Math.min(56, 330 / (longest * 0.75)));
}

export default function PartyStage({ posterImage, title, backHref }: PartyStageProps) {
  const poster = posterImage || null;

  return (
    <header
      // overflow-clip, not -hidden: the wings' scale-125 must not create a
      // scrollable box (focus / find-in-page could slide it).
      className={`party-page__hero relative isolate overflow-clip lg:mt-6 lg:rounded-t-[20px] ${
        poster ? '' : 'party-page__hero--tile'
      }`}
    >
      {poster ? (
        <>
          {/* The mask sits on this unscaled wrapper: on the scaled img it
              would end below the header and leave a hard edge. */}
          <div aria-hidden className="party-page__fade pointer-events-none absolute inset-0 overflow-clip">
            <Image
              src={poster}
              alt=""
              fill
              sizes="96px"
              loading="eager"
              className="scale-125 object-cover opacity-60 blur-[20px]"
            />
          </div>
          <div className="party-page__enter party-page__flyer absolute inset-x-4 bottom-6">
            <Image
              src={poster}
              alt={`Flyer for ${title}`}
              fill
              priority
              sizes="(max-width: 640px) calc(100vw - 32px), 544px"
              className="object-contain object-bottom"
            />
          </div>
        </>
      ) : (
        <>
          <div aria-hidden className="party-page__fade pointer-events-none absolute inset-0 bg-temple-surface" />
          <p
            aria-hidden
            className="party-page__tile party-page__fade pointer-events-none absolute inset-x-0 px-5 font-bold uppercase leading-[0.95] text-temple-purple-light/20"
            style={{ fontSize: tileFontSize(title) }}
          >
            {title}
          </p>
        </>
      )}

      <Link
        href={backHref}
        aria-label="Back"
        className={`party-page__back party-page__press absolute left-3 z-10 flex size-11 items-center justify-center rounded-full bg-temple-surface text-white ring-1 ring-inset ring-white/10 ${DECK_FOCUS_RING}`}
      >
        <BackIcon />
      </Link>
    </header>
  );
}
