'use client';

/**
 * MapContent — the Leaflet map itself: the day tabs floating over it, one
 * pin per party, and the PartySheet drawer that opens when you tap a pin.
 *
 * How a tap flows: Marker click → `openSheet(party)` → `selectedPartyId`
 * state → three things react to it at once:
 *   1. the pins re-render (selected one gets its focus ring, the rest fade),
 *   2. `SheetScrim` dims the tiles under the pins,
 *   3. `SelectionCamera` pans the pin into the strip of map above the sheet,
 * and the sheet renders as a plain React overlay beside the map. No Leaflet
 * popups are involved any more (location sponsors still have one — see
 * lib/sponsors.ts; directory sponsors like TU Eats don't drop a pin).
 */

import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import { Party, PartyDay } from '@/lib/types';
import { displayDoorTime, getDefaultDay, parseDoorsOpen, pickSmartDefaultDay } from '@/utils/dateHelpers';
import {
  PARTY_ZONE_BOUNDS,
  zoomToFitInside,
  pinVariantFor,
  partyPhase,
  showHostChip,
  DEFAULT_HOST_BRAND,
} from '@/utils/mapHelpers';
import { ringPinHtml, discPinHtml, discPinSize, discPinCellSize, pinLabelFor, RING_PIN_SIZE, RING_PIN_ANCHOR } from '@/utils/mapPins';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { openMapsDirections, shareContent } from '@/utils/shareHelpers';
import { trackEvent } from '@/utils/analytics';
import { partyHref } from '@/lib/authHelpers';
import { partiesApi } from '@/services/api';
import { useDemoMode } from '@/contexts/DemoModeContext';
import SegmentedTabs from '@/components/ui/SegmentedTabs';
import NavigateIcon from '@/components/ui/NavigateIcon';
import PartySheet from '@/components/map/PartySheet';
import { PRIMARY_SPONSOR, isMappableSponsor } from '@/lib/sponsors';

interface MapContentProps {
  parties: Party[];
  topPartyIds: Record<PartyDay, string | null>;
  userGoingParties: string[];
  onGoingClick: (partyId: string) => void;
  onNavigateClick: (partyId: string) => void;
  onRateClick: (partyId: string, title: string, host: string, ratingActive: boolean, ratingLocked: boolean) => void;
  thursdayDate: string;
  fridayDate: string;
  saturdayDate: string;
  /** Deep-link target (/map?party=<id>): pan the camera to this pin. Never opens the sheet. */
  focusPartyId?: string | null;
  /** Fires when the pin drawer opens or closes so the page can hide the tab bar. */
  onSheetOpenChange?: (open: boolean) => void;
  now?: Date;
}

// Temple University campus center — where the map opens (zoom 15). Sits
// inside PARTY_ZONE_BOUNDS, so the lock below never has to move it.
const TEMPLE_CENTER: [number, number] = [39.9812, -75.1550];

// CARTO raster tiles watermark without ?key= — set NEXT_PUBLIC_CARTO_API_KEY
// (free at https://carto.com/basemaps/apikey). Keep dark_all, not voyager.
const CARTO_TILE_URL = process.env.NEXT_PUBLIC_CARTO_API_KEY
  ? `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png?key=${process.env.NEXT_PUBLIC_CARTO_API_KEY}`
  : 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';

/** Where the map should look after a pin is selected. `zoom` is only set by deep links. */
type CameraTarget = { id: string; lat: number; lng: number; zoom?: number };

// Temple University label component
function TempleLabel() {
  const map = useMap();

  useEffect(() => {
    const labelIcon = L.divIcon({
      className: 'temple-label-icon',
      html: '<div class="campus-label">Temple University</div>',
      iconSize: [140, 30],
      iconAnchor: [70, 15],
    });

    const marker = L.marker([39.9795, -75.1570], {
      icon: labelIcon,
      interactive: false,
      zIndexOffset: -1000,
    }).addTo(map);

    return () => {
      map.removeLayer(marker);
    };
  }, [map]);

  return null;
}

/**
 * Keeps the map inside the party zone (York → Girard, 5th → 19th).
 *
 * Panning is handled by `maxBounds` on the MapContainer. This component
 * handles ZOOM-OUT: the floor is "the zoom where the zone exactly fills
 * the screen", so no pixel outside the zone can ever be on screen at
 * rest. That number depends on the viewport — roughly 15.2 on a phone
 * (the zone is only ~2.2 km tall) and ~16.2 on a wide desktop window —
 * so it has to be computed against the live map, not hard-coded, and
 * recomputed whenever the viewport changes (rotation, iOS toolbar
 * collapse, desktop window drag). Leaflet fires `resize` for all of those.
 *
 * Leaflet's own `getBoundsZoom(bounds, true)` would do this, but it snaps
 * to whole zoom levels (`zoomSnap`) and clamps to the *current* minZoom —
 * so after rotating to a wider viewport the floor could never come back
 * down. We project the box ourselves and hand the raw math to
 * `zoomToFitInside`.
 */
function PartyZoneLock() {
  const map = useMap();

  useEffect(() => {
    const zone = L.latLngBounds(PARTY_ZONE_BOUNDS);

    const apply = () => {
      const viewport = map.getSize();
      const zoom = map.getZoom();
      // Container not laid out yet (0×0) or map not initialised — nothing
      // sensible to compute; the next resize will try again.
      if (viewport.x === 0 || viewport.y === 0 || zoom == null) return;

      // How many screen pixels the zone covers at the current zoom.
      const box = L.bounds(
        map.project(zone.getNorthWest(), zoom),
        map.project(zone.getSouthEast(), zoom),
      ).getSize();

      const minZoom = zoomToFitInside(viewport, box, zoom);

      // Snap (not animate) if we're already below the floor — this runs on
      // first paint, and an animated zoom there reads as a flicker.
      if (zoom < minZoom) {
        map.setView(map.getCenter(), minZoom, { animate: false });
      }
      map.setMinZoom(minZoom);
    };

    apply();
    map.on('resize', apply);
    // The map wrapper grows/shrinks when the pin drawer hides the tab bar
    // (pb-20 comes off). Window `resize` does not fire for that — observe
    // the container and tell Leaflet its viewport changed.
    const ro = new ResizeObserver(() => {
      map.invalidateSize({ animate: false });
    });
    ro.observe(map.getContainer());
    return () => {
      map.off('resize', apply);
      ro.disconnect();
    };
  }, [map]);

  return null;
}

/**
 * Reports the map's zoom level up to React so the zoom ladder can re-render
 * the pins (host chips appear at ≥ 16). Leaflet owns the zoom; React only
 * needs to know when it settles.
 */
function ZoomWatcher({ onZoom }: { onZoom: (zoom: number) => void }) {
  const map = useMapEvents({
    zoomend: () => onZoom(map.getZoom()),
  });

  useEffect(() => {
    onZoom(map.getZoom());
  }, [map, onZoom]);

  return null;
}

/**
 * While the sheet is open: dims the map UNDER the pins, and closes the sheet
 * when you tap empty map.
 *
 * The dim is a Leaflet layer — a world-sized black rectangle in its own
 * pane, stacked between the tiles and the markers — rather than a DOM
 * overlay, because a DOM overlay would cover the markers too. The design
 * keeps every pin above the dim and fades the non-selected ones one by one
 * (the `is-muted` pin class), so the selected pin stays bright.
 *
 * Marker clicks never reach the map's click handler (Leaflet markers don't
 * bubble mouse events), so tapping another pin switches sheets instead of
 * closing.
 */
function SheetScrim({ active, onDismiss }: { active: boolean; onDismiss: () => void }) {
  const map = useMapEvents({
    click: () => {
      if (active) onDismiss();
    },
  });

  useEffect(() => {
    if (!active) return;
    if (!map.getPane('scrim')) {
      const pane = map.createPane('scrim');
      // Tiles are 200, overlays 400, markers 600 — sit just under the markers.
      pane.style.zIndex = '450';
      pane.style.pointerEvents = 'none';
    }
    // ±85° is the edge of Web Mercator; the rectangle covers the whole world.
    const scrim = L.rectangle([[-85, -180], [85, 180]], {
      pane: 'scrim',
      interactive: false,
      stroke: false,
      fillColor: '#000',
      fillOpacity: 0.5,
    }).addTo(map);
    return () => {
      map.removeLayer(scrim);
    };
  }, [active, map]);

  return null;
}

/**
 * Moves the map so the selected pin sits in the strip of map still visible
 * above the sheet (and below the day tabs). `panInside` pans the minimum
 * distance needed — if the pin is already in that strip, nothing moves.
 * Deep links also zoom to 17 first (the "pins + house" tier of the ladder).
 */
function SelectionCamera({
  target,
  sheetRef,
}: {
  target: CameraTarget | null;
  sheetRef: React.RefObject<HTMLDivElement>;
}) {
  const map = useMap();

  useEffect(() => {
    if (!target) return;
    const latlng = L.latLng(target.lat, target.lng);
    if (target.zoom != null) {
      map.setView(latlng, target.zoom, { animate: false });
    }
    // The sheet has already rendered by the time this effect runs, so we can
    // measure it instead of guessing; 320 is the fallback for a 0-height flash.
    const sheetHeight = sheetRef.current?.offsetHeight || 320;
    // `panInside` pads the ANCHOR point, and a ring pin's body is ±36px
    // around it (a full cell above it, via the stem) — so the padding has
    // to cover the body, or a pin can settle half off the screen edge.
    const half = RING_PIN_SIZE / 2;
    map.panInside(latlng, {
      paddingTopLeft: [24 + half, 96 + RING_PIN_SIZE],
      paddingBottomRight: [24 + half, sheetHeight + 24],
      animate: true,
    });
  }, [target, map, sheetRef]);

  return null;
}

// Sponsored marker icon — light-purple rounded square with the sponsor's initials
function createSponsorIcon(label: string): L.DivIcon {
  return L.divIcon({
    className: 'custom-marker',
    html: `<div class="sponsor-marker"><span class="sponsor-marker-label">${label}</span></div>`,
    iconSize: [48, 48],
    iconAnchor: [24, 24],
    popupAnchor: [0, -24],
  });
}

// Get short address (before comma)
function getShortAddress(address: string | null): string {
  if (!address) return 'Sign in for address';
  return address.split(',')[0];
}

// onRateClick stays in the props contract (pages still pass it) but rating
// went read-only on the map with the v2 redesign — it happens on the party page.
export default function MapContent({ parties, topPartyIds, userGoingParties, onGoingClick, onNavigateClick, thursdayDate, fridayDate, saturdayDate, focusPartyId, onSheetOpenChange, now: nowProp }: MapContentProps) {
  const router = useRouter();
  const demo = useDemoMode();
  const clock = nowProp ?? new Date();
  const [selectedDay, setSelectedDay] = useState<PartyDay>(() => getDefaultDay(nowProp ?? new Date()));
  const iconCacheRef = useRef<Map<string, L.DivIcon>>(new Map());
  const sheetRef = useRef<HTMLDivElement>(null);
  const [focusConsumed, setFocusConsumed] = useState(false);

  // Selection = which party's sheet is open. The camera target is set once
  // per selection (not derived every render) so the pan only fires once.
  const [selectedPartyId, setSelectedPartyId] = useState<string | null>(null);
  const [cameraTarget, setCameraTarget] = useState<CameraTarget | null>(null);
  const [zoom, setZoom] = useState(15);
  // The list endpoint doesn't carry hostStats ("12 parties hosted"); the
  // detail endpoint does. Fetched once per party the first time its sheet
  // opens, kept for the session.
  const [detailById, setDetailById] = useState<Record<string, Party>>({});

  const openSheet = useCallback((party: Party, zoomTo?: number) => {
    setSelectedPartyId(party.id);
    setCameraTarget({ id: party.id, lat: party.latitude, lng: party.longitude, zoom: zoomTo });
    trackEvent('map_sheet_opened', { partyId: party.id, partyTitle: party.title, source: 'pin' });
  }, []);

  const closeSheet = useCallback(() => {
    setSelectedPartyId(null);
    setCameraTarget(null);
  }, []);

  useEffect(() => {
    onSheetOpenChange?.(selectedPartyId !== null);
  }, [selectedPartyId, onSheetOpenChange]);

  useEffect(() => {
    return () => onSheetOpenChange?.(false);
  }, [onSheetOpenChange]);

  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) closeSheet();
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, [closeSheet]);

  useEffect(() => {
    if (demo || !selectedPartyId || detailById[selectedPartyId]) return;
    let cancelled = false;
    partiesApi
      .getParty(selectedPartyId)
      .then((detail) => {
        if (!cancelled) setDetailById((prev) => ({ ...prev, [selectedPartyId]: detail }));
      })
      .catch(() => {
        // The sheet already has everything it needs from the list; the
        // hosted-count line just stays off.
      });
    return () => {
      cancelled = true;
    };
  }, [demo, selectedPartyId, detailById]);

  // If the selected party drops out of the list (realtime removal, weekend
  // rollover) the sheet has nothing to show — close it.
  useEffect(() => {
    if (selectedPartyId && !parties.some((p) => p.id === selectedPartyId)) closeSheet();
  }, [parties, selectedPartyId, closeSheet]);

  // Deep-link focus (/map?party=<id>): switch to that night and pan to the
  // pin. The sheet stays closed — tapping the pin is what opens it.
  const deepLinkParty = !focusConsumed && focusPartyId
    ? parties.find((p) => p.id === focusPartyId) ?? null
    : null;

  // Smart default: switch to the first night that has parties if today's
  // default night is empty. Deep links skip this so their day's tab stays.
  const thursdayCount = useMemo(() => parties.filter(p => p.day === 'thursday').length, [parties]);
  const fridayCount = useMemo(() => parties.filter(p => p.day === 'friday').length, [parties]);
  const saturdayCount = useMemo(() => parties.filter(p => p.day === 'saturday').length, [parties]);
  const hasAppliedSmartDefault = useRef(false);
  useEffect(() => {
    if (parties.length === 0 || hasAppliedSmartDefault.current) return;
    hasAppliedSmartDefault.current = true;

    const hasDeepLink = Boolean(focusPartyId && parties.some((p) => p.id === focusPartyId));
    if (!hasDeepLink) {
      setSelectedDay(pickSmartDefaultDay(getDefaultDay(nowProp ?? new Date()), {
        thursday: thursdayCount,
        friday: fridayCount,
        saturday: saturdayCount,
      }));
    }
  }, [parties, thursdayCount, fridayCount, saturdayCount, focusPartyId, nowProp]);

  useEffect(() => {
    if (!deepLinkParty) return;
    setSelectedDay(deepLinkParty.day);
    setCameraTarget({
      id: deepLinkParty.id,
      lat: deepLinkParty.latitude,
      lng: deepLinkParty.longitude,
      zoom: 17,
    });
    setFocusConsumed(true);
    const url = new URL(window.location.href);
    if (url.searchParams.has('party')) {
      url.searchParams.delete('party');
      const next = `${url.pathname}${url.search}${url.hash}`;
      window.history.replaceState({}, '', next);
    }
  }, [deepLinkParty]);

  // Filter parties based on selected day
  const filteredParties = useMemo(() => {
    return parties.filter(party => party.day === selectedDay);
  }, [parties, selectedDay]);

  // The party the sheet shows: live list data (counts tick in realtime)
  // plus the hosted-count line from the detail fetch once it lands.
  const sheetParty = useMemo(() => {
    if (!selectedPartyId) return null;
    const party = parties.find((p) => p.id === selectedPartyId);
    if (!party) return null;
    const detail = detailById[selectedPartyId];
    return detail ? { ...party, hostStats: detail.hostStats } : party;
  }, [parties, selectedPartyId, detailById]);

  const openPartyPage = useCallback((via: 'tap' | 'swipe_up') => {
    if (!sheetParty) return;
    trackEvent('map_sheet_tapped', { partyId: sheetParty.id, partyTitle: sheetParty.title, via });
    router.push(partyHref(sheetParty.id, demo));
  }, [sheetParty, router, demo]);

  const handleShare = useCallback(async () => {
    if (!sheetParty) return;
    const result = await shareContent(sheetParty, demo ? { path: partyHref(sheetParty.id, true) } : undefined);
    trackEvent('party_shared', { method: result.method, success: result.success, partyId: sheetParty.id, surface: 'map_sheet' });
  }, [sheetParty, demo]);

  // Local const so TS narrowing (sponsor && ...) survives into the marker's
  // event-handler closures — imported bindings don't narrow across closures.
  // Directories like TU Eats have no lat/lng, so they never drop a pin.
  const sponsor =
    PRIMARY_SPONSOR && isMappableSponsor(PRIMARY_SPONSOR)
      ? PRIMARY_SPONSOR
      : undefined;

  // Get day numbers for display
  const thursdayNum = thursdayDate;
  const fridayNum = fridayDate;
  const saturdayNum = saturdayDate;

  const sheetOpen = selectedPartyId !== null;
  const chipsOn = showHostChip(zoom);
  const now = clock;

  return (
    <div className="w-full h-full relative" style={{ touchAction: 'none' }}>
      {/* Day filter — the same segmented control the home feed uses,
          floating over the top of the map. */}
      <div className="absolute top-4 lg:top-8 inset-x-4 z-[1100] max-w-xl mx-auto">
        <SegmentedTabs
          items={[
            { key: 'thursday', label: `THU ${thursdayNum}` },
            { key: 'friday', label: `FRI ${fridayNum}` },
            { key: 'saturday', label: `SAT ${saturdayNum}` },
          ]}
          activeKey={selectedDay}
          onChange={(key) => {
            closeSheet();
            setSelectedDay(key as PartyDay);
            trackEvent('day_tab_switched', { day: key, source: 'map' });
          }}
        />
      </div>

      {/* maxBounds = the party zone (York → Girard, 5th → 19th): you can't
          pan outside it. maxBoundsViscosity 0 is the rubber-band feel —
          drag a little past the edge and it springs back on release
          (1 would be a hard wall). Zoom-out is floored by PartyZoneLock
          so the zone always fills the screen. */}
      <MapContainer
        center={TEMPLE_CENTER}
        zoom={15}
        maxBounds={PARTY_ZONE_BOUNDS}
        maxBoundsViscosity={0}
        zoomControl={false}
        scrollWheelZoom={true}
        className="w-full h-full"
        style={{ background: '#1a1a1a' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url={CARTO_TILE_URL}
        />
        <PartyZoneLock />
        <ZoomWatcher onZoom={setZoom} />
        <SheetScrim active={sheetOpen} onDismiss={closeSheet} />
        <SelectionCamera target={cameraTarget} sheetRef={sheetRef} />
        <TempleLabel />
        {(() => {
          const maxGoingCount = Math.max(...filteredParties.map(p => p.goingCount ?? 0), 1);
          const iconCache = iconCacheRef.current;
          return filteredParties.map(party => {
            const variant = pinVariantFor(party);
            const isHyped = party.id === topPartyIds[party.day];
            const userIsGoing = userGoingParties.includes(party.id);
            const phase = partyPhase(parseDoorsOpen(party.doorsOpen, party.date), now);
            const isSelected = party.id === selectedPartyId;
            const isMuted = sheetOpen && !isSelected;
            const label = pinLabelFor(party.pinLabel, party.host);
            const chip = variant === 'ring' && chipsOn ? `${label} · ${displayDoorTime(party.doorsOpen)}` : null;
            const size = discPinSize(party.goingCount ?? 0, maxGoingCount);
            const discCell = discPinCellSize(size);

            // Every visual input is in the key, so a pin only rebuilds when
            // something about it actually changed (realtime ticks are cheap).
            const iconKey = [
              party.id, variant, party.goingCount, size, isHyped ? 1 : 0, userIsGoing ? 1 : 0,
              phase, isSelected ? 1 : 0, isMuted ? 1 : 0, chip ?? '',
            ].join('|');
            let icon = iconCache.get(iconKey);
            if (!icon) {
              icon = variant === 'ring'
                ? L.divIcon({
                    className: 'custom-marker',
                    html: ringPinHtml({
                      initials: label,
                      count: party.goingCount,
                      brand: DEFAULT_HOST_BRAND,
                      isSelected,
                      isGoing: userIsGoing,
                      isHyped,
                      isLive: phase === 'live',
                      isDimmed: phase === 'over',
                      isMuted,
                      chip,
                    }),
                    iconSize: [RING_PIN_SIZE, RING_PIN_SIZE],
                    iconAnchor: RING_PIN_ANCHOR,
                  })
                : L.divIcon({
                    className: 'custom-marker',
                    html: discPinHtml({
                      label,
                      count: party.goingCount,
                      size,
                      isSelected,
                      isGoing: userIsGoing,
                      isHyped,
                      isDimmed: phase === 'over',
                      isMuted,
                    }),
                    iconSize: [discCell, discCell],
                    iconAnchor: [size / 2, size / 2],
                  });
              iconCache.set(iconKey, icon);
            }

            return (
              <Marker
                key={party.id}
                position={[party.latitude, party.longitude]}
                icon={icon}
                zIndexOffset={isSelected ? 2000 : isHyped ? 1000 : 0}
                eventHandlers={{
                  click: () => {
                    trackEvent('map_marker_clicked', { partyId: party.id, partyTitle: party.title, pin: variant });
                    openSheet(party);
                  },
                }}
              />
            );
          });
        })()}

        {/* Sponsored pin + popup — driven by lib/sponsors.ts (empty array =
            nothing renders). Still a Leaflet popup: sponsors aren't parties,
            so they don't get the party sheet. */}
        {sponsor && (
          <Marker
            position={[sponsor.latitude, sponsor.longitude]}
            icon={createSponsorIcon(sponsor.pinLabel)}
            zIndexOffset={-500}
            eventHandlers={{
              popupopen: () => {
                trackEvent('sponsor_pin_popup_opened', { sponsor: sponsor.id });
              },
            }}
          >
            <Popup className="sponsor-popup-dark" closeButton={false}>
              <div className="popup-content">
                <div className="popup-badges">
                  <span className="popup-sponsor-badge">SPONSORED</span>
                </div>
                <h3 className="popup-title">{sponsor.name}</h3>
                <p className="popup-host">{sponsor.popupDescription}</p>
                {sponsor.tagline && (
                  <p className="font-montserrat font-semibold text-[12px] text-temple-purple-light !mt-0.5 !mb-0">
                    {sponsor.tagline}
                  </p>
                )}
                {sponsor.tagline2 && (
                  <p className="font-montserrat text-[11px] text-temple-purple-light/75 !mt-0.5 !mb-0">
                    {sponsor.tagline2}
                  </p>
                )}
                {/* Card-style data lines: plain muted text, no icon clutter. */}
                <div className="font-montserrat text-[13px] text-white/70 !mt-2 !mb-0">
                  {getShortAddress(sponsor.address)}
                  {sponsor.hoursInfo && ` · ${sponsor.hoursInfo}`}
                </div>
              </div>
              <div className="popup-buttons">
                {sponsor.orderUrl && (
                  <a
                    href={sponsor.orderUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="popup-going-btn"
                    style={{ textDecoration: 'none', color: 'white' }}
                    onClick={() => {
                      trackEvent('sponsor_order_clicked', { sponsor: sponsor.id });
                    }}
                  >
                    ORDER
                  </a>
                )}
                <button
                  type="button"
                  aria-label="Navigate"
                  onClick={() => {
                    trackEvent('sponsor_navigate_clicked', { sponsor: sponsor.id });
                    openMapsDirections(sponsor.address);
                  }}
                  className="popup-navigate-btn"
                  style={sponsor.orderUrl ? {} : { borderRadius: '0 0 12px 12px', width: '100%' }}
                >
                  <NavigateIcon className="w-[18px] h-[18px]" />
                </button>
              </div>
            </Popup>
          </Marker>
        )}
      </MapContainer>

      {/* The drawer. Keyed by party so switching pins remounts it (fresh
          slide-up, drag state reset) instead of morphing in place. */}
      {sheetParty && (
        <PartySheet
          ref={sheetRef}
          key={sheetParty.id}
          party={sheetParty}
          brand={pinVariantFor(sheetParty) === 'ring' ? DEFAULT_HOST_BRAND : null}
          isHeadliner={sheetParty.id === topPartyIds[sheetParty.day]}
          phase={partyPhase(parseDoorsOpen(sheetParty.doorsOpen, sheetParty.date), now)}
          userIsGoing={userGoingParties.includes(sheetParty.id)}
          onClose={closeSheet}
          onGoingClick={() => onGoingClick(sheetParty.id)}
          onNavigateClick={() => {
            onNavigateClick(sheetParty.id);
            if (sheetParty.address) openMapsDirections(sheetParty.address);
          }}
          onOpenParty={openPartyPage}
          onShare={handleShare}
        />
      )}
    </div>
  );
}
