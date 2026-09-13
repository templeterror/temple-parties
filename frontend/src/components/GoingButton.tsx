'use client';

/**
 * GoingButton — the RSVP button. Tapping it marks you as going (or un-going);
 * the label always carries the live going count so the button doubles as the
 * party's popularity readout.
 *
 * Two shapes for the two places it lives:
 *  - bar:  full-width block ("GOING (67)") — headliner card + party-page
 *          sticky bar. Grows to fill its row (flex-1).
 *  - pill: compact chip ("GOING · 23" → "✓ IN · 52") — the tail cards.
 *
 * Two tones for the ticketed party page (WF-D2), where BUY TICKETS is the
 * primary action and GOING steps back to an outline:
 *  - primary:   solid purple (going state shows the softer gradient).
 *  - secondary: hairline outline, stays quiet next to a filled neighbor.
 *
 * The count is null for logged-out viewers (the server strips it — the
 * soft gate), so the label gracefully drops the number instead of lying
 * with a zero.
 */

import { memo, startTransition, useState } from 'react';

export type GoingButtonVariant = 'bar' | 'pill';

interface GoingButtonProps {
  currentCount: number | null;
  userIsGoing: boolean;
  onGoingClick: () => void;
  variant?: GoingButtonVariant;
  tone?: 'primary' | 'secondary';
  /** Lets a host surface (the map sheet) layer a material class on top. */
  className?: string;
}

function GoingButton({
  currentCount,
  userIsGoing,
  onGoingClick,
  variant = 'bar',
  tone = 'primary',
  className = '',
}: GoingButtonProps) {
  // Quick squash-and-pop animation on tap — purely cosmetic feedback while
  // the optimistic count update happens upstream.
  const [isAnimating, setIsAnimating] = useState(false);

  const handleClick = () => {
    startTransition(() => {
      onGoingClick();
    });
    setIsAnimating(true);
    setTimeout(() => setIsAnimating(false), 200);
  };

  const label =
    variant === 'pill'
      ? userIsGoing
        ? `✓ IN${currentCount !== null ? ` · ${currentCount}` : ''}`
        : `GOING${currentCount !== null ? ` · ${currentCount}` : ''}`
      : `GOING${currentCount !== null ? ` (${currentCount})` : ''}`;

  const shapeClass =
    variant === 'pill'
      ? 'h-[32px] px-4 rounded-full text-[12px]'
      : 'flex-1 min-w-0 py-3 rounded-[10px] text-[14px]';

  const toneClass =
    tone === 'secondary'
      ? 'border border-white/15 text-white'
      : userIsGoing
        ? 'bg-gradient-to-r from-temple-purple/50 to-temple-purple text-white'
        : 'bg-temple-purple text-white';

  return (
    <button
      onClick={handleClick}
      title={userIsGoing ? 'Click to un-go' : 'Click to go'}
      className={`${shapeClass} ${toneClass} font-bold uppercase transition-all duration-150 flex items-center justify-center gap-1.5 font-montserrat hover:opacity-90 active:scale-[0.98] ${
        isAnimating ? 'animate-going-click' : ''
      } ${className}`}
    >
      {userIsGoing && variant !== 'pill' && (
        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
        </svg>
      )}
      {label}
    </button>
  );
}

// memo: the feed re-renders on every live count tick; unchanged buttons skip it.
export default memo(GoingButton);
