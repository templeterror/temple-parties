'use client';

/**
 * HostTonightPrompt — Saturday night glass sheet that rises above the
 * tab bar and asks the visitor to list a party.
 *
 * Copy is always about posting the party. Hosts (and admins)
 * still go to /create; everyone else goes to /become-host.
 *
 * Material is frosted glass (fixed overlay, not a scrolling surface — the
 * DESIGN.md blur ban is for feed/map). A dedicated layer holds the
 * backdrop-filter so rounded clipping does not kill the frost.
 *
 * Dismiss is a drawer swipe (same ~90px threshold as PartySheet). Escape
 * still closes it; there is no ✕.
 */

import { useRef, useState, useEffect, type PointerEvent } from 'react';
import Link from 'next/link';
import { Z_INDEX } from '@/lib/constants';
import { HOST_TONIGHT_CTA } from '@/lib/hostTonightPrompt';
import useHostTonightPrompt from '@/hooks/useHostTonightPrompt';

/** Same finger-travel threshold PartySheet uses to close. */
const CLOSE_DRAG_PX = 90;

export default function HostTonightPrompt() {
  const { visible, href, body, dismiss, onCta } = useHostTonightPrompt();
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startY = useRef<number | null>(null);
  const lastDy = useRef(0);

  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismiss();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visible, dismiss]);

  if (!visible) return null;

  const onPointerDown = (e: PointerEvent<HTMLElement>) => {
    if ((e.target as HTMLElement).closest('a, button')) return;
    startY.current = e.clientY;
    lastDy.current = 0;
    setDragging(true);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: PointerEvent<HTMLElement>) => {
    if (startY.current === null) return;
    const dy = e.clientY - startY.current;
    lastDy.current = dy;
    // Upward drag is damped so the sheet does not float off the nav.
    setDragY(dy > 0 ? dy : dy / 3);
  };

  const onPointerUp = () => {
    if (startY.current === null) return;
    startY.current = null;
    setDragging(false);
    const dy = lastDy.current;
    lastDy.current = 0;
    if (dy > CLOSE_DRAG_PX) {
      dismiss();
      return;
    }
    setDragY(0);
  };

  return (
    <>
      {/* Keeps the last feed card from sitting under the floating card. */}
      <div className="h-36 lg:h-40" aria-hidden />

      <div
        className="pointer-events-none fixed inset-x-0 bottom-24 lg:bottom-8 flex justify-center px-3 lg:px-6"
        style={{ zIndex: Z_INDEX.hostPrompt }}
      >
        <div className="w-full max-w-md animate-host-prompt-in">
        <aside
          role="dialog"
          aria-labelledby="host-tonight-title"
          aria-describedby="host-tonight-body"
          className={`host-tonight-prompt pointer-events-auto relative w-full select-none ${
            dragging ? 'cursor-grabbing' : 'cursor-grab'
          }`}
          style={{
            transform: `translateY(${Math.max(dragY, -24)}px)`,
            transition: dragging ? 'none' : 'transform 200ms ease-out',
            touchAction: 'none',
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <div className="host-tonight-prompt__glass" aria-hidden />

          <div className="relative px-4 pb-4">
            {/* Grabber — same visual cue PartySheet uses. The whole sheet
                drags; the bar is just the hint that you pull it down. */}
            <div className="flex justify-center pt-2.5 pb-2" aria-hidden>
              <div className="w-9 h-1 rounded-full bg-temple-purple-light/45" />
            </div>

            <p className="font-montserrat font-bold text-[11px] tracking-[1.1px] uppercase text-temple-purple-light">
              Tonight
            </p>

            <h2
              id="host-tonight-title"
              className="mt-1.5 font-montserrat font-bold text-[20px] leading-6 text-white"
            >
              Throwing a party?
            </h2>

            <p
              id="host-tonight-body"
              className="mt-1.5 font-montserrat text-[13.5px] leading-5 text-temple-purple-light"
            >
              {body}
            </p>

            <Link
              href={href}
              onClick={onCta}
              className="mt-3.5 flex w-full items-center justify-center py-3 rounded-[10px] bg-temple-purple text-white font-montserrat font-bold text-[14px] uppercase tracking-[0.4px] hover:opacity-90 active:scale-[0.98] transition-all duration-150"
            >
              {HOST_TONIGHT_CTA}
            </Link>
          </div>
        </aside>
        </div>
      </div>
    </>
  );
}
