'use client';

/**
 * HostTonightPrompt — glass bottom drawer that asks the visitor to list
 * a party. Copy is always about posting. Hosts (and admins) still go to
 * /create; everyone else goes to /become-host.
 *
 * While it's open AppShell hides the mobile tab bar, same as PartySheet
 * on the map: the sheet sits on the bottom of the screen and takes that
 * chrome's place. Extra bottom padding clears the iOS Safari URL bar.
 *
 * Material is frost on a dedicated layer (fixed overlay, not a scrolling
 * surface — the DESIGN.md blur ban is for feed/map). Dismiss is a drawer
 * swipe (same ~90px threshold as PartySheet). Escape still closes it;
 * there is no ✕.
 */

import { useRef, useState, useEffect, type PointerEvent } from 'react';
import Link from 'next/link';
import { Z_INDEX } from '@/lib/constants';
import { HOST_TONIGHT_CTA, type HostTonightHref } from '@/lib/hostTonightPrompt';
import useHostTonightPrompt from '@/hooks/useHostTonightPrompt';

/** Same finger-travel threshold PartySheet uses to close. */
const CLOSE_DRAG_PX = 90;

export function HostTonightPromptSheet({
  visible,
  href,
  body,
  dismiss,
  onCta,
}: {
  visible: boolean;
  href: HostTonightHref;
  body: string;
  dismiss: () => void;
  onCta: () => void;
}) {
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
      {/* Lets the last feed card scroll above the drawer. */}
      <div className="h-44 lg:h-48" aria-hidden />

      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 flex justify-center"
        style={{ zIndex: Z_INDEX.hostPrompt }}
      >
        <div className="w-full max-w-md lg:max-w-[480px] animate-host-prompt-in">
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

            <div className="relative px-5 pb-[calc(env(safe-area-inset-bottom)+2.75rem)] lg:pb-5">
              <div className="flex justify-center pt-2.5 pb-2" aria-hidden>
                <div className="w-9 h-1 rounded-full bg-temple-purple-light/45" />
              </div>

              <h2
                id="host-tonight-title"
                className="font-montserrat font-bold text-[20px] leading-6 text-white"
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
                className="host-tonight-prompt__cta mt-3.5 flex w-full items-center justify-center py-3 rounded-[10px] text-white font-montserrat font-bold text-[14px] uppercase tracking-[0.4px]"
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

/** Test/standalone entry: owns the cadence hook. AppShell uses the sheet + hook together so it can hide the tab bar in the same render. */
export default function HostTonightPrompt() {
  const prompt = useHostTonightPrompt();
  return <HostTonightPromptSheet {...prompt} />;
}
