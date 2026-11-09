/**
 * VoteArrow — the reddit-style vote arrow (chunky arrow with a stem) used
 * by VoteRow and the party page's vote buttons.
 *
 * Two states: outline at rest, and FILLED once it's your vote — the fill
 * takes currentColor, and the callers set that to the secondary light
 * purple, so a cast vote reads instantly without any extra chrome.
 */

export default function VoteArrow({
  direction,
  filled = false,
  className = 'w-4 h-4',
}: {
  direction: 'up' | 'down';
  filled?: boolean;
  className?: string;
}) {
  const path =
    direction === 'up'
      ? 'M12 3.5 19.5 11.5H15V20.5H9V11.5H4.5L12 3.5Z'
      : 'M12 20.5 4.5 12.5H9V3.5H15V12.5H19.5L12 20.5Z';

  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        d={path}
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}
