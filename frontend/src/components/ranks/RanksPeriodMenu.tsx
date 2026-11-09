'use client';

/**
 * RanksPeriodMenu — the Ranks page's ONE period control (Last weekend /
 * This month / This semester / By hosts). The owner kept a single dropdown
 * over stacked tabs (2026-08-17); the Podium redesign (2026-11-09) made it a
 * compact pill in the header row instead of a full-width card.
 *
 * Menu-button pattern (WAI-ARIA):
 *  - trigger: aria-haspopup="menu", aria-expanded, aria-controls while open;
 *    ↓ / ↑ on the trigger opens on the current / last item.
 *  - items: role="menuitemradio" + aria-checked; ↑ / ↓ wrap, Home / End jump,
 *    Enter / Space pick (native buttons), Escape closes and returns focus to
 *    the trigger, Tab closes and lets focus move on.
 *  - a tap outside closes AND swallows the click it produces, so dismissing
 *    the menu over a podium step doesn't also open that party.
 *
 * State: `value` + `onValueChange` (controlled, how RankingsView uses it) or
 * `defaultValue` (uncontrolled). Open/closed is always internal.
 * Motion: menu grows from its trigger in 150ms (`.ranks-menu` in
 * globals.css), closes instantly; off under reduced motion.
 */

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { DECK_FOCUS_RING } from '@/components/feed/RankStrip';
import { PERIOD_LABELS, RANKINGS_FILTERS, type RankingsFilter } from '@/utils/ranks';

interface RanksPeriodMenuProps {
  /** Controlled selection. */
  value?: RankingsFilter;
  /** Uncontrolled starting selection (ignored when `value` is set). */
  defaultValue?: RankingsFilter;
  /** Fires only when the selection actually changes. */
  onValueChange?: (value: RankingsFilter) => void;
  className?: string;
}

export default function RanksPeriodMenu({
  value,
  defaultValue = 'this-semester',
  onValueChange,
  className = '',
}: RanksPeriodMenuProps) {
  const [uncontrolled, setUncontrolled] = useState(defaultValue);
  const selected = value ?? uncontrolled;

  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  // Which item takes focus when the menu opens (set just before opening).
  const startIndex = useRef(0);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    itemRefs.current[startIndex.current]?.focus();

    // Outside tap: close, then eat the click that pointerdown turns into.
    // The guard drops itself at the next gesture in case this one was a
    // scroll rather than a click (no click would ever arrive to consume it).
    const swallowClick = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };
    const dropGuard = () => document.removeEventListener('click', swallowClick, true);
    const onPointerDown = (e: PointerEvent) => {
      if (wrapRef.current?.contains(e.target as Node)) return;
      setOpen(false);
      document.addEventListener('click', swallowClick, { capture: true, once: true });
      setTimeout(() => document.addEventListener('pointerdown', dropGuard, { capture: true, once: true }), 0);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const openAt = (index: number) => {
    startIndex.current = index;
    setOpen(true);
  };

  const closeToTrigger = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  const select = (next: RankingsFilter) => {
    if (next !== selected) {
      if (value === undefined) setUncontrolled(next);
      onValueChange?.(next);
    }
    closeToTrigger();
  };

  const onTriggerKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    openAt(e.key === 'ArrowUp' && !open ? RANKINGS_FILTERS.length - 1 : RANKINGS_FILTERS.indexOf(selected));
  };

  const onMenuKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const items = itemRefs.current;
    const n = RANKINGS_FILTERS.length;
    const cur = items.findIndex((el) => el === document.activeElement);
    let next: number;
    switch (e.key) {
      case 'ArrowDown':
        next = (cur + 1) % n;
        break;
      case 'ArrowUp':
        next = (cur - 1 + n) % n;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = n - 1;
        break;
      case 'Escape':
        e.preventDefault();
        e.stopPropagation();
        closeToTrigger();
        return;
      case 'Tab':
        setOpen(false);
        return;
      default:
        return;
    }
    e.preventDefault();
    items[next]?.focus();
  };

  return (
    <div ref={wrapRef} className={`relative shrink-0 ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => (open ? setOpen(false) : openAt(RANKINGS_FILTERS.indexOf(selected)))}
        onKeyDown={onTriggerKeyDown}
        // Trailing-icon optics: pr is 4px less than pl (emil-ui-polish #9).
        className={`ranks__press flex h-11 items-center gap-1.5 rounded-full bg-temple-surface pl-4 pr-3 text-[14px] font-semibold ring-1 ring-inset ring-white/10 hover:bg-temple-surface-2 ${DECK_FOCUS_RING}`}
      >
        <span className="sr-only">Period: </span>
        {PERIOD_LABELS[selected].menu}
        <svg
          aria-hidden
          viewBox="0 0 16 16"
          className="ranks-menu__chevron size-4 text-temple-muted"
          data-open={open || undefined}
          fill="none"
        >
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label="Period"
          onKeyDown={onMenuKeyDown}
          className="ranks-menu absolute right-0 top-full z-30 mt-2 w-52 rounded-xl bg-temple-surface p-1 shadow-2xl shadow-black ring-1 ring-white/10"
        >
          {RANKINGS_FILTERS.map((option, i) => {
            const checked = option === selected;
            return (
              <button
                key={option}
                ref={(el) => {
                  itemRefs.current[i] = el;
                }}
                type="button"
                role="menuitemradio"
                aria-checked={checked}
                // Roving focus: arrows move it, Tab leaves the menu.
                tabIndex={-1}
                onClick={() => select(option)}
                className="flex h-11 w-full items-center justify-between gap-3 rounded-lg px-3 text-left text-[15px] font-medium hover:bg-temple-surface-2 focus:bg-temple-surface-2 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-white"
              >
                {PERIOD_LABELS[option].menu}
                {checked && <CheckIcon />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CheckIcon() {
  return (
    <svg aria-hidden viewBox="0 0 16 16" className="size-4 shrink-0 text-temple-purple-light" fill="none">
      <path d="M3.5 8.5l3 3 6-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
