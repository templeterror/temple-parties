'use client';

/**
 * PartyDeckSkeleton — the deck's loading shape: the rank strip's thumbs and
 * one full card (flyer area + info panel + control row), sized by the same
 * useDeckFrame as PartyDeck so nothing jumps when the parties arrive.
 */

import { useRef } from 'react';
import useDeckFrame, { DECK_FALLBACK_HEIGHT } from './useDeckFrame';

const BLOCK = 'bg-zinc-900/50';

export default function PartyDeckSkeleton() {
  const rootRef = useRef<HTMLDivElement>(null);
  const frame = useDeckFrame(rootRef);

  return (
    <div
      ref={rootRef}
      aria-hidden
      className="mx-auto flex w-full max-w-xl animate-pulse flex-col lg:max-w-md"
      style={{
        height: frame ? frame.height : DECK_FALLBACK_HEIGHT,
        marginBottom: frame ? frame.marginBottom : undefined,
      }}
    >
      <div className="flex shrink-0 px-3 pb-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex h-12 w-11 shrink-0 items-center justify-center">
            <div className={`h-10 w-8 rounded-[6px] ${BLOCK}`} />
          </div>
        ))}
      </div>
      <div className="min-h-0 flex-1 px-4 pb-2 lg:pb-6">
        <div className="flex h-full flex-col justify-end rounded-[20px] bg-zinc-900/30 p-4">
          <div className={`h-5 w-24 rounded ${BLOCK}`} />
          <div className={`mt-2 h-6 w-3/4 rounded ${BLOCK}`} />
          <div className={`mt-2 h-4 w-1/2 rounded ${BLOCK}`} />
          <div className={`mt-2 h-4 w-2/3 rounded ${BLOCK}`} />
          <div className="mt-3 flex gap-2">
            <div className={`h-11 flex-1 rounded-full ${BLOCK}`} />
            <div className={`size-11 rounded-full ${BLOCK}`} />
            <div className={`h-11 w-24 rounded-full ${BLOCK}`} />
          </div>
        </div>
      </div>
    </div>
  );
}
