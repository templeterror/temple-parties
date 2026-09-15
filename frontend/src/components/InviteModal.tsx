'use client';

/**
 * InviteModal — the "you're in, now bring people" drawer that pops the
 * moment someone taps GOING (Home feed, the party page, and both demo
 * routes).
 *
 * It used to be a centred ModalWrapper card with a party emoji. Now it is
 * a bottom drawer cut from the same frost as HostTonightPrompt and the map
 * PartySheet — one material for every sheet that rises off the bottom of
 * the screen. The `.invite-sheet*` selectors comma-join onto the existing
 * `.host-tonight-prompt*` rules in globals.css, so the three can never
 * drift apart.
 *
 * The optional `party` prop is the party the user just RSVP'd to. When a
 * caller passes it we show a PartySheet-style row (poster thumb, title,
 * host, day @ door time) so the drawer is obviously about *that* party;
 * without it we fall back to generic copy.
 *
 * Soft-gate rule: `goingCount` is null for logged-out visitors, and null
 * means "we don't know", not zero — so the count is simply left off rather
 * than rendered as "0 going".
 *
 * Dismiss is the drawer trio: swipe down past ~90px, Escape, or tap the
 * backdrop. No close button, no glow (DESIGN.md rule 1), no emoji.
 */

import { useRef, useState, type PointerEvent } from 'react';
import type { Party } from '@/lib/types';
import { Z_INDEX } from '@/lib/constants';
import { getDayName, displayDoorTime } from '@/utils/dateHelpers';
import useModalBehavior from '@/hooks/useModalBehavior';
import ShareIcon from '@/components/ui/ShareIcon';

/** Same finger-travel threshold HostTonightPrompt and PartySheet close on. */
const CLOSE_DRAG_PX = 90;

interface InviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShare: () => void;
  /** The party that was just RSVP'd to. Optional: callers without one get generic copy. */
  party?: Party | null;
}

export default function InviteModal({ isOpen, onClose, onShare, party }: InviteModalProps) {
  // Drag state: how far the sheet has been pulled, and whether a pointer is
  // currently down (so the snap-back transition is off mid-drag).
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startY = useRef<number | null>(null);
  const lastDy = useRef(0);

  // Escape to close + body-scroll lock, the same hook every modal here uses.
  useModalBehavior(isOpen, onClose);

  if (!isOpen) return null;

  const handleShare = () => {
    // Order matters: share first, then close (callers fire their own toast).
    onShare();
    onClose();
  };

  const onPointerDown = (e: PointerEvent<HTMLElement>) => {
    // Links and buttons keep their normal taps; only the sheet body drags.
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
    // Upward drag is damped so the sheet doesn't fly off-screen; the close
    // decision below uses lastDy (real finger travel).
    setDragY(dy > 0 ? dy : dy / 3);
  };

  const onPointerUp = () => {
    if (startY.current === null) return;
    startY.current = null;
    setDragging(false);
    const dy = lastDy.current;
    lastDy.current = 0;
    if (dy > CLOSE_DRAG_PX) {
      onClose();
      return;
    }
    setDragY(0);
  };

  // "Friday @ 10 PM", plus "· 42 going" only when the server gave us a count.
  const timeLine = party
    ? `${getDayName(party.day)} @ ${displayDoorTime(party.doorsOpen)}${
        party.goingCount != null ? ` · ${party.goingCount} going` : ''
      }`
    : null;

  return (
    <div
      data-testid="modal-backdrop"
      onClick={onClose}
      className="fixed inset-0 bg-black/60 flex items-end justify-center"
      style={{ zIndex: Z_INDEX.modal }}
    >
      {/* Stop clicks inside the drawer from reaching the backdrop's close. */}
      <div
        className="w-full max-w-md lg:max-w-[480px] animate-host-prompt-in"
        onClick={(e) => e.stopPropagation()}
      >
        <aside
          role="dialog"
          aria-labelledby="invite-title"
          className={`invite-sheet relative w-full select-none ${
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
          <div className="invite-sheet__glass" aria-hidden />

          <div className="relative px-5 pb-[calc(env(safe-area-inset-bottom)+2.75rem)] lg:pb-5">
            {/* Grabber — the affordance for the swipe-down dismiss. */}
            <div className="flex justify-center pt-2.5 pb-2" aria-hidden>
              <div className="w-9 h-1 rounded-full bg-temple-purple-light/45" />
            </div>

            <p className="font-montserrat font-bold text-[11px] uppercase tracking-[0.6px] text-temple-muted">
              You&apos;re in
            </p>

            <h2
              id="invite-title"
              className="mt-1 font-montserrat font-bold text-[20px] leading-6 text-white"
            >
              Bring the crew
            </h2>

            {party ? (
              // Party row, same anatomy as PartySheet's header: thumb + identity.
              <div className="mt-3 flex items-center gap-3 min-w-0">
                <div className="size-[56px] shrink-0 rounded-[12px] overflow-hidden bg-temple-surface-2">
                  {party.posterImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={party.posterImage} alt="" className="size-full object-cover" />
                  ) : (
                    <div className="size-full flex items-center justify-center">
                      <span className="font-montserrat font-bold text-[18px] text-temple-purple-light">
                        {party.host.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0 flex flex-col gap-[3px]">
                  <p className="font-montserrat font-bold text-[14px] leading-[18px] text-white uppercase truncate">
                    {party.title}
                  </p>
                  <p className="font-montserrat text-[12.5px] leading-4 text-temple-purple-light truncate">
                    {party.host}
                  </p>
                  <p className="font-montserrat text-[12.5px] leading-4 text-temple-muted truncate">
                    {timeLine}
                  </p>
                </div>
              </div>
            ) : (
              <p className="mt-1.5 font-montserrat text-[13.5px] leading-5 text-temple-purple-light">
                Send the link so your friends pull up too.
              </p>
            )}

            <button
              type="button"
              onClick={handleShare}
              className="invite-sheet__cta mt-3.5 flex w-full items-center justify-center gap-2 py-3 rounded-[10px] text-white font-montserrat font-bold text-[14px] uppercase tracking-[0.4px]"
            >
              <ShareIcon className="w-4 h-4" />
              Share with friends
            </button>

            <button
              type="button"
              onClick={onClose}
              className="mt-2 w-full py-2 font-montserrat text-[13px] text-temple-muted hover:text-white transition-colors duration-150"
            >
              Maybe later
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
