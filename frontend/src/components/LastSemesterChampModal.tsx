'use client';

/**
 * LastSemesterChampModal — what the crown next to a host's name means.
 *
 * Opens from the tappable crown on the party page's host line. The hero is the
 * jewelled CrownIllustration — same silhouette as the 16px CrownIcon you just
 * tapped, drawn with the detail a hero can afford — on a surface disc, then a
 * tracked section label, the host's name as the headline, one sentence of
 * explanation, and the Ranks CTA.
 *
 * Copy is deliberately short — this is a tooltip with a button, not a page.
 * The ✕ exists because on a phone "tap outside to close" isn't obvious and
 * the primary button navigates away.
 */

import { useRouter } from 'next/navigation';
import ModalWrapper from './ModalWrapper';
import CrownIllustration from '@/components/ui/CrownIllustration';
import SectionLabel from '@/components/ui/SectionLabel';
import { LAST_SEM_RANKS_HREF } from '@/lib/lastSemesterChampions';
import { trackEvent } from '@/utils/analytics';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** Host display name for the headline. Falls back to a generic line. */
  hostName?: string;
}

export default function LastSemesterChampModal({ isOpen, onClose, hostName }: Props) {
  const router = useRouter();

  const handleSeeRankings = () => {
    trackEvent('last_sem_champ_cta_clicked');
    onClose();
    router.push(LAST_SEM_RANKS_HREF);
  };

  return (
    <ModalWrapper isOpen={isOpen} onClose={onClose}>
      {/* Close — top-right, quiet. Hit area is the full 36px square. */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute top-3 right-3 size-9 inline-flex items-center justify-center rounded-full text-temple-muted hover:text-white hover:bg-white/5 transition-colors"
      >
        <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>

      <div className="flex flex-col items-center text-center">
        {/* Hero: the jewelled crown on the same surface disc avatars use. */}
        <div className="size-[104px] rounded-full bg-temple-surface-2 border border-white/10 flex items-center justify-center">
          <CrownIllustration size={76} />
        </div>

        <SectionLabel className="mt-5">Last semester&apos;s #1 host</SectionLabel>

        <h2 className="mt-1.5 font-montserrat font-bold text-[22px] leading-[26px] text-white break-words max-w-full">
          {hostName?.trim() || 'This host'}
        </h2>

        <p className="mt-3 font-montserrat text-[14px] leading-[21px] text-temple-muted max-w-[280px]">
          #1 in the host rankings last semester
        </p>

        <button
          type="button"
          onClick={handleSeeRankings}
          className="mt-6 w-full py-3.5 rounded-xl bg-temple-purple text-white font-montserrat font-bold text-[15px] tracking-[0.2px] transition hover:opacity-90 active:scale-[0.98]"
        >
          See host rankings
        </button>
      </div>
    </ModalWrapper>
  );
}
