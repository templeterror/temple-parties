/**
 * BottomNav's mobile Dock and desktop bar: active tab + aria-current, the
 * Solid `dock-*` mask glyphs, demo twins, the data-bottom-chrome footprint
 * marker, and Home-on-Home → HomeReselect.
 */

import { fireEvent, render } from '@testing-library/react';
import BottomNav from '@/components/BottomNav';
import { HomeReselectProvider, useOnHomeReselect } from '@/contexts/HomeReselectContext';

let mockPathname = '/';
jest.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}));

function dock(): HTMLElement {
  const el = document.querySelector<HTMLElement>('nav[data-bottom-chrome="dock"]');
  if (!el) throw new Error('dock not rendered');
  return el;
}

function dockLink(label: string): HTMLAnchorElement {
  const link = dock().querySelector<HTMLAnchorElement>(`a[aria-label="${label}"]`);
  if (!link) throw new Error(`no ${label} link`);
  return link;
}

function Listener({ onReselect }: { onReselect: () => void }) {
  useOnHomeReselect(onReselect);
  return null;
}

describe('BottomNav dock', () => {
  beforeEach(() => {
    mockPathname = '/';
  });

  it('marks the current tab and shows only its label', () => {
    mockPathname = '/map';
    render(<BottomNav />);
    expect(dock().getAttribute('aria-label')).toBe('Main');
    expect(dockLink('Map').getAttribute('aria-current')).toBe('page');
    expect(dockLink('Home').getAttribute('aria-current')).toBeNull();
    expect(dockLink('Map').textContent).toBe('Map');
    expect(dockLink('Home').textContent).toBe('');
    expect(dockLink('Home').getAttribute('href')).toBe('/');
    expect(dockLink('Profile').getAttribute('href')).toBe('/profile');
  });

  it.each([
    ['/', 'Home'],
    ['/map', 'Map'],
    ['/leaderboards', 'Ranks'],
    ['/profile', 'Profile'],
  ])('on %s every tab masks its Figma dock-*.svg and %s is current', (path, current) => {
    mockPathname = path;
    render(<BottomNav />);
    const icons: Record<string, string> = {
      Home: '/icons/dock-home.svg',
      Map: '/icons/dock-map.svg',
      Ranks: '/icons/dock-ranks.svg',
      Profile: '/icons/dock-profile.svg',
    };
    for (const [label, icon] of Object.entries(icons)) {
      const link = dockLink(label);
      expect(link.querySelector('img')).toBeNull();
      const glyph = link.querySelector<HTMLElement>('span[aria-hidden]');
      expect(glyph?.style.maskImage).toBe(`url(${icon})`);
      const isCurrent = label === current;
      expect(link.getAttribute('aria-current')).toBe(isCurrent ? 'page' : null);
      // Colour is the token on the mask, never in the asset.
      expect(glyph?.className).toContain(isCurrent ? 'bg-temple-purple-light' : 'bg-temple-muted');
    }
  });

  it('desktop bar shows the same masked glyph for every tab, Profile included', () => {
    mockPathname = '/leaderboards';
    render(<BottomNav desktopOnly />);
    const bar = document.querySelector('nav')!;
    const masks = Array.from(bar.querySelectorAll<HTMLElement>('a span[aria-hidden]')).map((s) => s.style.maskImage);
    expect(masks).toEqual([
      'url(/icons/dock-home.svg)',
      'url(/icons/dock-map.svg)',
      'url(/icons/dock-ranks.svg)',
      'url(/icons/dock-profile.svg)',
    ]);
    expect(bar.querySelector('img')).toBeNull();
  });

  it('swaps to demo twins and hides Profile under /demo', () => {
    mockPathname = '/demo/leaderboards';
    render(<BottomNav />);
    expect(dockLink('Home').getAttribute('href')).toBe('/demo');
    expect(dockLink('Map').getAttribute('href')).toBe('/demo/map');
    expect(dockLink('Ranks').getAttribute('aria-current')).toBe('page');
    expect(dock().querySelector('a[aria-label="Profile"]')).toBeNull();
  });

  it('is suppressed on pushed routes (desktopOnly)', () => {
    render(<BottomNav desktopOnly />);
    expect(document.querySelector('[data-bottom-chrome]')).toBeNull();
  });

  it('tapping Home on Home reselects instead of navigating', () => {
    mockPathname = '/demo';
    const onReselect = jest.fn();
    render(
      <HomeReselectProvider>
        <Listener onReselect={onReselect} />
        <BottomNav />
      </HomeReselectProvider>,
    );
    const notPrevented = fireEvent.click(dockLink('Home'));
    expect(notPrevented).toBe(false);
    expect(onReselect).toHaveBeenCalledTimes(1);
  });

  it('Home on a Home-tab page that is not Home still navigates', () => {
    mockPathname = '/create';
    const onReselect = jest.fn();
    render(
      <HomeReselectProvider>
        <Listener onReselect={onReselect} />
        <BottomNav />
      </HomeReselectProvider>,
    );
    expect(dockLink('Home').getAttribute('aria-current')).toBe('page');
    fireEvent.click(dockLink('Home'));
    expect(onReselect).not.toHaveBeenCalled();
  });
});
