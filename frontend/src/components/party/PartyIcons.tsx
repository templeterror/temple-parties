/**
 * PartyIcons — the party page's one line-icon family: a 24-unit box drawn
 * at 20px, 1.75 stroke, round caps and joins, `currentColor`. The grouped
 * facts list (When / Where / Tickets / Promo / Going) leads each row with
 * one; the back disc and the Copy → ✓ swap use the heavier-stroke variants.
 *
 * All decorative (`aria-hidden`): every row and control carries its own
 * text or aria-label. Kept apart from the kit's filled glyphs
 * (NavigateIcon, ShareIcon, VoteArrow) on purpose — those are action
 * marks, these are list markers.
 */

import type { ReactNode } from 'react';

function LineIcon({ children, className = 'size-5' }: { children: ReactNode; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
      focusable="false"
    >
      {children}
    </svg>
  );
}

export const CalendarIcon = () => (
  <LineIcon>
    <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
    <path d="M3.5 10h17M8 3v4M16 3v4" />
  </LineIcon>
);

export const PinIcon = () => (
  <LineIcon>
    <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z" />
    <circle cx="12" cy="10" r="2.25" />
  </LineIcon>
);

export const TicketIcon = () => (
  <LineIcon>
    <path d="M3.5 8.5V7a1.5 1.5 0 0 1 1.5-1.5h14A1.5 1.5 0 0 1 20.5 7v1.5a2.5 2.5 0 0 0 0 5V17a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 17v-1.5a2.5 2.5 0 0 0 0-5Z" />
    <path d="M14 6v2.5M14 11v2M14 15.5V18" />
  </LineIcon>
);

export const TagIcon = () => (
  <LineIcon>
    <path d="M3.5 12.1V4.75c0-.7.55-1.25 1.25-1.25h7.35c.33 0 .65.13.88.37l7.4 7.4a1.25 1.25 0 0 1 0 1.77l-7.35 7.35a1.25 1.25 0 0 1-1.77 0l-7.4-7.4a1.25 1.25 0 0 1-.36-.89Z" />
    <circle cx="8.25" cy="8.25" r="1.5" />
  </LineIcon>
);

export const PeopleIcon = () => (
  <LineIcon>
    <circle cx="9" cy="8.5" r="3.25" />
    <path d="M3 19.5c.6-3 3-4.75 6-4.75s5.4 1.75 6 4.75" />
    <path d="M15.5 5.6a3.25 3.25 0 0 1 0 5.8M17.5 14.9c1.8.6 3.1 2.1 3.5 4.6" />
  </LineIcon>
);

export const CheckIcon = () => (
  <LineIcon className="size-[18px]">
    <path d="M5 12.5l4.5 4.5L19 7.5" strokeWidth={2.25} />
  </LineIcon>
);

export const BackIcon = () => (
  <LineIcon className="size-5">
    <path d="M15 5l-7 7 7 7" strokeWidth={2.25} />
  </LineIcon>
);
