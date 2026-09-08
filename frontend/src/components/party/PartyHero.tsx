/**
 * PartyHero — the full-bleed top of the party page: the poster on its
 * cinema stage with the back arrow floating on top.
 *
 * The party page is a "pushed" route (you drilled in from a feed), so it
 * trades the tab bar for a back arrow. That arrow always goes to the home
 * feed. router.back() is wrong here: after login or Safari restore,
 * history.length is still > 1 but the previous entry is this same party
 * URL, so back() remounts the detail page and the user is stuck.
 */

import { useRouter } from 'next/navigation';
import StagePoster from '@/components/ui/StagePoster';

interface PartyHeroProps {
  posterImage?: string;
  title: string;
  /** Where the back arrow lands. Live party page → home; demo → /demo. */
  backHref?: string;
}

export default function PartyHero({ posterImage, title, backHref = '/' }: PartyHeroProps) {
  const router = useRouter();

  return (
    <StagePoster src={posterImage} title={title} heightClass="h-[320px]" priority>
      <div className="flex items-center px-4 h-14">
        <button
          type="button"
          onClick={() => router.push(backHref)}
          aria-label="Go back"
          className="size-9 flex items-center justify-center rounded-full bg-black/60 text-white text-[18px] hover:bg-black/80 transition-colors"
        >
          ←
        </button>
      </div>
    </StagePoster>
  );
}
