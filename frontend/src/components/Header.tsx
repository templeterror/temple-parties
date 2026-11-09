'use client';

/**
 * Header — the compact mobile page header: the tuparties wordmark (or a
 * page title on inner pages like the map).
 *
 * Mobile-only (lg:hidden) because desktop gets the fixed top bar from
 * BottomNav instead. Slim (2026-11-07 nav decision): the top inset is the
 * safe area with a 12px floor, not a fixed 40px, so the deck gets the height. The old login/profile link is gone — Profile is a
 * bottom-nav tab now, so the header stays a quiet one-liner.
 */

import Wordmark from '@/components/ui/Wordmark';

interface HeaderProps {
  /** Inner pages pass a title ("Party Map"); the feed shows the wordmark. */
  title?: string;
}

export default function Header({ title }: HeaderProps) {
  return (
    <header className="bg-black pt-[max(env(safe-area-inset-top),12px)] pb-1.5 lg:hidden">
      <div className="max-w-xl mx-auto px-4">
        <h1 className="font-montserrat font-bold text-[20px] leading-6 text-white">
          {title ?? <Wordmark />}
        </h1>
      </div>
    </header>
  );
}
