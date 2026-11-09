'use client';

/**
 * LastSemesterChampBadge — the gold crown for hosts who won last semester.
 *
 * Sits on the host line (feed cards + the party page), right after the
 * VerifiedMark, never in the category/HEADLINER tag row. It's a bare glyph,
 * no box, no fill behind it — the same "owner crown next to the name" idiom
 * Discord uses, which survives at tiny sizes. Gold (`temple-hyped`) is what
 * "#1" already means on the Ranks page; there's no glow, which stays
 * reserved for HEADLINER (DESIGN.md rule 1).
 *
 * Proportions: a 16px crown sits optically level with the 15px VerifiedMark
 * seal (the crown is wider than tall, so it needs the extra pixel to carry
 * the same visual weight). The two are designed as a pair — change both or
 * neither. No margin of its own — the host row owns the spacing (`gap-1`).
 *
 * Two modes:
 *  - `interactive` (the party page's host line): a real <button>; tap opens
 *    the explainer modal, which names the host (`hostName`). The ::after
 *    pseudo pads the hit area 14px on every side — 16px glyph → 44×44px
 *    target — without changing what you see. The seal beside it stays
 *    static there, so the two padded targets never overlap.
 *  - static (feed cards, the default): a plain <span> with a title tooltip.
 *    Cards are ONE tap target (the stretched Link) — a clickable crown there
 *    would steal taps from the card, so the feed just shows the mark.
 */

import { useState } from 'react';
import CrownIcon from '@/components/ui/CrownIcon';
import LastSemesterChampModal from './LastSemesterChampModal';
import { trackEvent } from '@/utils/analytics';

const LABEL = '#1 host last semester';

/** Shared look for both modes — keep the two renders pixel-identical. */
const MARK_CLASSES = 'shrink-0 inline-flex items-center justify-center text-temple-hyped';

interface LastSemesterChampBadgeProps {
  /** Render as a tappable button that opens the modal. Default: static mark. */
  interactive?: boolean;
  /** The host's display name, shown in the modal. Only needed when interactive. */
  hostName?: string;
}

export default function LastSemesterChampBadge({ interactive = false, hostName }: LastSemesterChampBadgeProps) {
  const [open, setOpen] = useState(false);

  if (!interactive) {
    return (
      <span title={LABEL} aria-label={LABEL} role="img" className={MARK_CLASSES}>
        <CrownIcon />
      </span>
    );
  }

  const handleClick = () => {
    trackEvent('last_sem_champ_badge_clicked');
    setOpen(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        title={LABEL}
        aria-label={LABEL}
        className={`relative ${MARK_CLASSES} transition hover:opacity-85 active:scale-95 after:absolute after:-inset-[14px] after:content-['']`}
      >
        <CrownIcon />
      </button>
      <LastSemesterChampModal isOpen={open} onClose={() => setOpen(false)} hostName={hostName} />
    </>
  );
}
