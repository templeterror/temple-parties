'use client';

/**
 * useDeckFrame — sizes the party deck (and its skeleton) to exactly the
 * space between where it starts (under the day tabs / demo banner) and the
 * bottom chrome, so Home never scrolls vertically: one party per screen.
 *
 * Bottom chrome declares itself: the mobile Dock (BottomNav) and
 * HostTonightPrompt, which replaces the Dock while it's open (AppShell),
 * both carry `data-bottom-chrome`, and the deck reserves the tallest one's
 * offsetHeight. The Dock floats (a gap under the pill), so its footprint is
 * read from its own box — never guessed from what touches the screen edge.
 * offsetHeight ignores transforms (the prompt's slide-in and drag) and is 0
 * when the element is display:none (the lg:hidden Dock on desktop), so
 * desktop runs the deck to the bottom edge.
 *
 * The page wrapper's bottom padding (--dock-clearance) and the prompt's
 * in-flow spacer still sit after the deck, so the returned negative
 * `marginBottom` cancels exactly that trailing space:
 * top + height + margin + trailing = viewport.
 *
 * Re-measures on viewport resize (incl. the iOS URL bar), on body resize
 * (fonts, banners) and when AppShell swaps the Dock for the prompt
 * (a childList change on <main>; deliberately not subtree, so realtime
 * count ticks inside the feed don't trigger it), and when a chrome element
 * itself resizes.
 */

import { useLayoutEffect, useState, type RefObject } from 'react';

export interface DeckFrame {
  height: number;
  marginBottom: number;
}

/** Below this the page scrolls rather than squeezing the card further. */
const MIN_HEIGHT = 320;

/**
 * Before the first measurement: slim mobile header (≈42) + day tabs (≈60)
 * + the Dock's declared footprint.
 */
export const DECK_FALLBACK_HEIGHT = 'calc(100dvh - 102px - var(--dock-footprint))';

/** Elements that occupy the bottom of the screen (see the file comment). */
const BOTTOM_CHROME = '[data-bottom-chrome]';

function bottomChrome(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(BOTTOM_CHROME));
}

function bottomChromeHeight(chrome: HTMLElement[]): number {
  return chrome.reduce((max, el) => Math.max(max, el.offsetHeight), 0);
}

/**
 * Layout top in the document via the offsetTop chain — unlike
 * getBoundingClientRect it ignores transforms, so measuring during the
 * deck's 8px mount rise doesn't leave the deck 8px short.
 */
function documentTop(el: HTMLElement): number {
  let top = 0;
  let node: HTMLElement | null = el;
  while (node) {
    top += node.offsetTop;
    node = node.offsetParent as HTMLElement | null;
  }
  return top;
}

export default function useDeckFrame(ref: RefObject<HTMLElement>): DeckFrame | null {
  const [frame, setFrame] = useState<DeckFrame | null>(null);

  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;

    const measure = () => {
      const viewportH = window.innerHeight;
      const rect = root.getBoundingClientRect();
      const top = documentTop(root);
      const chromeEls = bottomChrome();
      chromeEls.forEach((el) => ro.observe(el));
      const chrome = bottomChromeHeight(chromeEls);
      const height = Math.max(MIN_HEIGHT, Math.floor(viewportH - top - chrome));

      // In-flow content after the deck, measured with the current margin
      // taken back out. When the page is shorter than the viewport this
      // over-reads (main is min-h-screen), which only pulls the margin in
      // further — still no scroll, and the next pass is stable.
      const currentMargin = parseFloat(getComputedStyle(root).marginBottom) || 0;
      const trailing = Math.max(
        0,
        document.documentElement.scrollHeight - (top + rect.height) - currentMargin,
      );
      const marginBottom = Math.round(chrome - trailing);

      setFrame((prev) =>
        prev && prev.height === height && prev.marginBottom === marginBottom
          ? prev
          : { height, marginBottom },
      );
    };

    let raf = 0;
    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(measure);
    };
    const ro = new ResizeObserver(schedule);

    measure();
    ro.observe(document.body);
    const main = root.closest('main');
    const mo = main ? new MutationObserver(schedule) : null;
    if (main && mo) mo.observe(main, { childList: true });
    window.addEventListener('resize', schedule);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      mo?.disconnect();
      window.removeEventListener('resize', schedule);
    };
  }, [ref]);

  return frame;
}
