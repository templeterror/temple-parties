/**
 * Pure map helpers — no Leaflet, no React — so they can be unit-tested.
 *
 *  1. The PARTY ZONE: the rectangle the map is locked to.
 *  2. "Which pin should we show first?" (TUP-10).
 */

import type { PartyDay } from '@/lib/types';
import { coverTileValue } from './coverPrice';

/* ------------------------------------------------------------------ */
/* 1. Party zone                                                        */
/* ------------------------------------------------------------------ */

/**
 * Soft city lock for the map: a Philadelphia rectangle so campus parties,
 * Fishtown, University City / Drexel, Center City, and Lincoln Financial
 * are all reachable. Zoom-out floors at "the city fills the screen";
 * panning rubber-bands at the edges (see PartyZoneLock in MapContent).
 *
 * Keep in sync with VALID_BOUNDS in backend/app/services/geocoding.py.
 */
export const PARTY_ZONE = {
  north: 40.1,
  south: 39.875,
  east: -75.05,
  west: -75.28,
} as const;

/**
 * Same box in the shape Leaflet wants for `maxBounds`:
 * `[[south, west], [north, east]]` (bottom-left corner, top-right corner).
 */
export const PARTY_ZONE_BOUNDS: [[number, number], [number, number]] = [
  [PARTY_ZONE.south, PARTY_ZONE.west],
  [PARTY_ZONE.north, PARTY_ZONE.east],
];

/** True when a coordinate sits inside the party zone (edges count as in). */
export function isInsidePartyZone(lat: number, lng: number): boolean {
  return (
    lat >= PARTY_ZONE.south &&
    lat <= PARTY_ZONE.north &&
    lng >= PARTY_ZONE.west &&
    lng <= PARTY_ZONE.east
  );
}

/** A width/height pair in screen pixels. */
export type PixelSize = { x: number; y: number };

/**
 * The zoom level at which the screen fits *exactly inside* a box — i.e. the
 * furthest you can zoom out without any pixel outside the box showing.
 *
 * How it works: on a web map, zooming out by one level halves the size of
 * everything on screen. So if the box is currently `box` pixels big at
 * zoom `atZoom`, and the screen is `viewport` pixels big, we need to scale
 * the box by `viewport / box` to make it match — and `log2` of that scale
 * is how many zoom levels that is. We take the *tighter* of width and
 * height (`Math.max` of the two ratios) because the box has to cover the
 * screen in BOTH directions.
 *
 * Rounded UP to 0.01 so floating-point noise can never leave the box a
 * hair smaller than the screen (which would let a sliver of outside show).
 */
export function zoomToFitInside(viewport: PixelSize, box: PixelSize, atZoom: number): number {
  const scale = Math.max(viewport.x / box.x, viewport.y / box.y);
  const zoom = atZoom + Math.log2(scale);
  return Math.ceil(zoom * 100) / 100;
}

/* ------------------------------------------------------------------ */
/* 2. Featured pin (TUP-10)                                              */
/* ------------------------------------------------------------------ */

/*
 * Headliner wins when we know it; otherwise the most-going party of that
 * night. Logged-out counts are null — those sort last so we never treat a
 * gated dash as a fake zero.
 */

export type FeaturedPartyInput = {
  id: string;
  day: PartyDay;
  goingCount: number | null;
};

export type TopPartyIds = Record<PartyDay, string | null>;

export function pickFeaturedParty<T extends FeaturedPartyInput>(
  parties: T[],
  topPartyIds: TopPartyIds,
  day: PartyDay,
): T | null {
  const ofDay = parties.filter((p) => p.day === day);
  if (ofDay.length === 0) return null;

  const topId = topPartyIds[day];
  if (topId) {
    const headliner = ofDay.find((p) => p.id === topId);
    if (headliner) return headliner;
  }

  return ofDay.reduce((best, party) => {
    const count = party.goingCount ?? -1;
    const bestCount = best.goingCount ?? -1;
    return count > bestCount ? party : best;
  });
}

/* ------------------------------------------------------------------ */
/* 3. Pin + sheet rules (map redesign, Figma §13)                        */
/* ------------------------------------------------------------------ */

/**
 * A host's brand is three colour slots (straight from the Figma skins note):
 *  - primary   → pin ring, the "HOST · 11 PM" chip stroke, the live pulse
 *  - secondary → the plate inside the ring (behind the initials / logo)
 *  - accent    → the count badge, the LIVE NOW tag, the initials
 * `accentInk` is the text colour that sits on the accent.
 *
 * There's no host colour picker yet, so every branded pin uses the app's
 * own palette. When the picker ships, this object is what it replaces —
 * the pin CSS reads these as variables, so nothing else has to change.
 */
export type HostBrand = {
  primary: string;
  secondary: string;
  accent: string;
  accentInk: string;
};

export const DEFAULT_HOST_BRAND: HostBrand = {
  primary: '#b24bf3',
  secondary: '#ffffff',
  accent: '#b24bf3',
  accentInk: '#ffffff',
};

/**
 * Which pin a party gets. Unverified hosts keep the full-purple `disc`.
 * Verified hosts get the GPHI `ring` (white plate, purple ring, stem,
 * hanging count) — stand-in for the paid layer until a real gate exists.
 */
export type PinVariant = 'disc' | 'ring';

export function pinVariantFor(party: { isVerified: boolean }): PinVariant {
  return party.isVerified ? 'ring' : 'disc';
}

/**
 * How long after doors open a party still counts as "live" (pulse ring on
 * the pin, LIVE NOW tag in the sheet). Same 4 hours the map has always
 * used before it starts dimming a pin — `over` IS the old "dimmed".
 */
export const LIVE_WINDOW_MS = 4 * 60 * 60 * 1000;

export type PartyPhase = 'upcoming' | 'live' | 'over';

export function partyPhase(doorsOpenAt: Date, now: Date): PartyPhase {
  const elapsed = now.getTime() - doorsOpenAt.getTime();
  if (elapsed < 0) return 'upcoming';
  if (elapsed < LIVE_WINDOW_MS) return 'live';
  return 'over';
}

/**
 * Zoom ladder. The persistent "HOST · 11 PM" chip beside a ring pin only
 * appears once the map is zoomed in enough to have room for it; below that
 * it's pins only. The Philly soft lock floors zoom-out around ~11–12, so
 * the design's z ≤ 14 "dots only" tier is reachable when zoomed out.
 */
export const HOST_CHIP_MIN_ZOOM = 16;

export function showHostChip(zoom: number): boolean {
  return zoom >= HOST_CHIP_MIN_ZOOM;
}

/**
 * COVER tile copy. The value is always one of FREE / $N / — (see
 * utils/coverPrice.ts — hosts type prose, tiles show data). Ticketed
 * parties (a ticket link exists) get the TICKETS label; with no readable
 * price they show a dash here rather than ONLINE, because the sheet has no
 * BUY TICKETS bar to give that word meaning.
 */
export function coverStat(party: { ticketPrice?: string | null; ticketUrl?: string | null }): {
  value: string;
  label: string;
} {
  const ticketed = Boolean(party.ticketUrl);
  return {
    value: coverTileValue(party.ticketPrice, ticketed, '—'),
    label: ticketed ? 'TICKETS' : 'COVER',
  };
}
