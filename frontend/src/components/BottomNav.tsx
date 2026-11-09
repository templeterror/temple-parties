'use client';

/**
 * BottomNav — the app's chrome: the mobile Dock (Home / Map / Ranks /
 * Profile) and a fixed top bar on desktop. Spec: DESIGN.md decision log,
 * 2026-11-07 "Nav chrome → Dock + slim Classic top".
 *
 * The Dock is a detached floating pill above the safe area — solid
 * temple-surface, hairline ring, no glass. Icons are the owner's Figma
 * exports in /public/icons (the `-active` file when active); only the active
 * tab shows its label. Tapping Home while on Home emits HomeReselect
 * (PartyDeck jumps back to #1) instead of re-navigating.
 *
 * Its footprint is the CSS vars --dock-pill / --dock-inset in globals.css,
 * and the nav carries `data-bottom-chrome` so useDeckFrame reserves exactly
 * its height. The pill floats: the full-width nav is pointer-events-none so
 * content beside the pill stays tappable.
 *
 * On /demo/* paths every link swaps to its demo twin (and Profile is hidden)
 * so the read-only demo can never leak into the live app.
 *
 * The Profile tab is the login entry point too: logged-out visitors who tap
 * it hit /profile, which redirects them to /login — no separate login link
 * needed anywhere else.
 *
 * `desktopOnly` supports "pushed" routes (the party page) and bottom sheets
 * (HostTonightPrompt, the map PartySheet): they take the Dock's place on
 * mobile, while desktop keeps its top bar.
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { CSSProperties, MouseEvent } from 'react';
import Wordmark from '@/components/ui/Wordmark';
import { useEmitHomeReselect } from '@/contexts/HomeReselectContext';

type NavKey = 'home' | 'map' | 'rankings' | 'profile';

/** White, never brand-coloured (emil-ui-polish). */
const FOCUS_RING =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white';

/** No Figma asset exists for Profile — the original glyph (stroke = currentColor). */
function ProfileIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-[22px]" aria-hidden>
      <circle cx="12" cy="8" r="3.25" stroke="currentColor" strokeWidth="1.8" />
      <path d="M5.5 19c1.2-3 3.5-4.5 6.5-4.5s5.3 1.5 6.5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Dock icon. Active: the `-active` Figma asset as-is (light-purple fill,
 * purple stroke). Idle: the idle asset strokes `#0B0B0B` at 50% — invisible
 * on black as an <img> — so it's drawn as a CSS mask over white: same
 * geometry, and the asset's own 50% stroke opacity lands it near
 * temple-muted.
 */
function DockGlyph({ item, active }: { item: (typeof MAIN_NAV)[number]; active: boolean }) {
  if (!item.icon) {
    return (
      <span className={`flex shrink-0 ${active ? 'text-temple-purple' : 'text-temple-muted'}`}>
        <ProfileIcon />
      </span>
    );
  }
  if (active) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={item.iconActive} alt="" aria-hidden className="block size-[22px] shrink-0 object-contain" />
    );
  }
  const mask: CSSProperties = {
    WebkitMaskImage: `url(${item.icon})`,
    maskImage: `url(${item.icon})`,
    WebkitMaskSize: 'contain',
    maskSize: 'contain',
    WebkitMaskRepeat: 'no-repeat',
    maskRepeat: 'no-repeat',
    WebkitMaskPosition: 'center',
    maskPosition: 'center',
  };
  return <span aria-hidden className="block size-[22px] shrink-0 bg-white" style={mask} />;
}

// Figma icon files: the Dock masks/uses them, the desktop bar shows them next
// to its text labels. Profile has no asset (DockGlyph draws ProfileIcon).
const MAIN_NAV: { key: NavKey; href: string; label: string; icon: string; iconActive: string }[] = [
  {
    key: 'home',
    href: '/',
    label: 'Home',
    icon: '/icons/home.svg',
    iconActive: '/icons/home-active.svg',
  },
  {
    key: 'map',
    href: '/map',
    label: 'Map',
    icon: '/icons/map.svg',
    iconActive: '/icons/map-active.svg',
  },
  {
    key: 'rankings',
    href: '/leaderboards',
    label: 'Ranks',
    icon: '/icons/leaderboards.svg',
    iconActive: '/icons/leaderboards-active.svg',
  },
  {
    key: 'profile',
    href: '/profile',
    label: 'Profile',
    icon: '',
    iconActive: '',
  },
];

const DEMO_NAV = MAIN_NAV.filter((item) => item.key !== 'profile').map((item) => ({
  ...item,
  href:
    item.key === 'home'
      ? '/demo'
      : item.key === 'map'
        ? '/demo/map'
        : '/demo/leaderboards',
}));

function isDemoPath(pathname: string): boolean {
  return pathname === '/demo' || pathname.startsWith('/demo/');
}

function activeKeyFromPath(pathname: string): NavKey {
  if (pathname === '/map' || pathname === '/demo/map' || pathname.startsWith('/map/')) return 'map';
  if (
    pathname === '/leaderboards' ||
    pathname === '/demo/leaderboards' ||
    pathname.startsWith('/leaderboards/')
  ) {
    return 'rankings';
  }
  if (pathname === '/profile' || pathname.startsWith('/profile/')) return 'profile';
  return 'home';
}

export default function BottomNav({ desktopOnly = false }: { desktopOnly?: boolean }) {
  const pathname = usePathname() ?? '/';
  const demo = isDemoPath(pathname);
  const nav = demo ? DEMO_NAV : MAIN_NAV;
  const active = activeKeyFromPath(pathname);
  const homeHref = demo ? '/demo' : '/';

  return (
    <>
      {/* Desktop top bar — always present so big screens keep persistent nav. */}
      <nav
        className="hidden lg:flex fixed top-0 left-0 right-0 h-16 bg-[#0b0b0b]/95 backdrop-blur-md border-b border-white/10 items-center px-8"
        style={{ zIndex: 9999 }}
      >
        <Link href={homeHref}>
          <Wordmark />
        </Link>

        <div className="ml-auto flex items-center gap-8">
          {nav.map((item) => {
            const isActive = active === item.key;
            // One name per place: the page title, the Dock, and this top bar
            // all say "Ranks" (2026-11-09 Podium decision).
            const desktopLabel = item.label;
            return (
              <Link
                key={item.key}
                href={item.href}
                className={`flex items-center gap-2 text-[15px] font-montserrat font-semibold transition-colors duration-200 ${
                  isActive ? 'text-temple-purple' : 'text-white/60 hover:text-white'
                }`}
              >
                {item.icon && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={isActive ? item.iconActive : item.icon}
                    alt=""
                    className="w-6 h-6"
                  />
                )}
                {desktopLabel}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Mobile Dock — suppressed on pushed routes / under sheets via desktopOnly. */}
      {!desktopOnly && <Dock nav={nav} active={active} onHome={pathname === homeHref} />}
    </>
  );
}

function Dock({
  nav,
  active,
  onHome,
}: {
  nav: typeof MAIN_NAV;
  active: NavKey;
  /** Already on the Home route itself (not just a Home-tab page like /create). */
  onHome: boolean;
}) {
  const reselectHome = useEmitHomeReselect();

  const handleHomeReselect = (e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    reselectHome();
  };

  return (
    <nav
      aria-label="Main"
      data-bottom-chrome="dock"
      className="lg:hidden pointer-events-none fixed inset-x-0 bottom-0 flex justify-center"
      style={{ zIndex: 9999, paddingBottom: 'var(--dock-inset)' }}
    >
      <div className="pointer-events-auto flex h-[var(--dock-pill)] items-center gap-0.5 rounded-full bg-temple-surface p-1 shadow-[0_8px_24px_rgba(0,0,0,0.5)] ring-1 ring-inset ring-white/10">
        {nav.map((item) => {
          const isActive = active === item.key;
          return (
            <Link
              key={item.key}
              href={item.href}
              onClick={isActive && item.key === 'home' && onHome ? handleHomeReselect : undefined}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
              className={`dock-press flex h-11 items-center justify-center rounded-full font-montserrat ${
                isActive ? 'gap-2 bg-temple-surface-2 pl-3.5 pr-4' : 'w-12 hover:bg-white/[0.06]'
              } ${FOCUS_RING}`}
            >
              <DockGlyph item={item} active={isActive} />
              {isActive && (
                <span aria-hidden className="text-[13px] font-semibold leading-none text-temple-purple-light">
                  {item.label}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
