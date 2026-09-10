# DESIGN.md — the tuparties v2 design system (as built)

> The record of design decisions to-do task 4.1 asked for. This documents the
> system as it EXISTS in code after the WF-B2/WF-D redesign (Figma
> `tuparties Redesign`, node 148-742) landed on `epic-8` and was iterated live
> with the owner on 2026-08-17. When code and this file disagree, fix one of
> them — this file is only useful while it's true.

## Palette

| Token | Value | Role |
|---|---|---|
| `temple-purple` | `#b24bf3` | Primary. Actions (GOING, tabs, category chips), active nav, links |
| `temple-purple-light` | `#e0d4ff` | Secondary. Navigate buttons, host lines, cast-vote fill, COPY |
| `temple-hyped` | `var(--temple-hyped)` = `#FFD60A` | The HEADLINER badge. **The app's ONE glow** — nothing else glows |
| `temple-hyped-ink` | `var(--temple-hyped-ink)` = `#0a0a0f` | Text on the hyped yellow |
| `temple-surface` | `#1a1a1d` | Flat modules (nav bar, tabs container, detail-page cards) |
| `temple-surface-2` | `#252528` | Feed cards (with `border-white/10` hairline) |
| `temple-muted` | `#9a9a9a` | Secondary text, section labels, idle icons |
| base | `#000` | Page background |

Retired: green `#10B981` (v1 going-state), cyan `#45E0FF` (Figma proposal —
owner rejected 2026-08-17). The hyped accent lives as CSS custom properties in
`globals.css :root` because the hand-rolled Leaflet popup CSS must read the
exact same values — change the accent there and components + map popups move
together. Everything else is a Tailwind token in `tailwind.config.ts`
(`temple.*`); components never hardcode hex.

## Typography

- **Wordmark:** bold Montserrat `tuparties`, `tu` in `temple-purple`
  (`ui/Wordmark.tsx`). One component used by the mobile Header and the desktop
  top bar. Bitcount is retired from chrome.
- **UI font:** Montserrat everywhere in the redesigned surfaces.
- Card scale (compact card): title 20/24 bold · host 14 · time 14 · votes 14.
  Hero: title 24 uppercase · host 15. Detail: title 28 uppercase.
- Section labels: 10–11px bold, tracking ~1px, uppercase, muted
  (`ui/SectionLabel.tsx`).

## Component kit

Generic kit in `frontend/src/components/ui/` (heaviest-commented code in the
repo, per conventions.md): `Pill` (tones: hyped / accent / neutral / overlay;
chips are `shape="square"` — 4px corners — everywhere), `SegmentedTabs`,
`StatTile`, `SectionLabel`, `IconButton` (accent = light-purple fill),
`DashedCard`, `StickyActionBar` (z-9000, safe-area padded), `StagePoster`
(cinema blur-wings, CSS blur on a static img — never backdrop-filter; one per
page), `VoteArrow` (reddit-style, fills when cast), `VoteRow`, `AddressGate`,
`VerifiedMark` (one inline-SVG scalloped seal, light purple + black check, 15px;
exports `VerifiedSealIcon` for the map popup), `CrownIcon` (flat 16px gold crown,
`currentColor`) + `CrownIllustration` (its jewelled 64px+ sibling: gradient
gold, faceted peaks, pearl tips, brand-purple gems — hero use only),
`NavigateIcon` (solid paper plane), `ShareIcon`, `Wordmark`.
Beside the seal, `LastSemesterChampBadge` is the bare 16px `CrownIcon` (no box,
no fill, no glow) for last semester's top host — the two are sized as a pair,
and host rows space them with `gap-1` only. The crown is static on feed cards
(the card is the tap target) and tappable only on the party-page HostRow, where
it opens `LastSemesterChampModal`: `CrownIllustration` on a surface disc,
section label, the host's name, one explainer sentence, Ranks CTA, and a ✕.

Party-page pieces in `components/party/`: `PartyHero`, `HostRow`,
`WhenWhereCard`, `PromoCard`, `RatingPanel`.

Map pieces (Figma §13): pins are raw HTML for Leaflet, built in
`utils/mapPins.ts` and styled in `globals.css`. Two pins — the full-purple
`disc` (unverified hosts) and the branded `ring` pin (verified hosts, the
stand-in for the paid layer): white plate, purple ring, stem, hanging count
badge. Both pins show going count as the same pill badge. Headliner yellow
halo + ★ layers on the ring. States layer on: selected
(white focus ring, 1.15×), going (✓ on the badge), headliner (thin hyped halo
+ ★), live (slow pulse, doors → +4h), over (dimmed), muted (another sheet is
open). A host brand is three CSS vars — `--pin-primary` (ring / chip / pulse),
`--pin-secondary` (plate), `--pin-accent` (badge / LIVE tag / initials) — set
per pin; `DEFAULT_HOST_BRAND` is the app palette until the colour picker
ships. Zoom ladder: pins at 15–16, pins + "HOST · 11 PM" chip at ≥ 16; the
lit-house layer is designed but not built (needs parcel footprints). Tapping
a pin opens `components/map/PartySheet` — the bottom drawer that replaced
the Leaflet popup: poster thumb ringed in the brand colour, HEADLINER /
category + LIVE NOW tags, title, host line with "N parties hosted", STARTS /
COVER / STARTS / SHARE row (the party page's stat row with the door time in
the middle seat), address + read-only votes on one row, then GOING + navigate
(the sticky-bar pair; the count lives on the GOING button). Drag down closes,
drag up or tap the header pushes the party page.
While it's open the map dims under the pins and the map is locked to the
party zone (York → Girard, 5th → 19th — `PARTY_ZONE` in `utils/mapHelpers.ts`).
Also in the kit:
`AddressAutocomplete` (shared by create-party + become-host), the
rankings pieces `RankChampionCard` / `RankingRow` / `HostRankingRow`, and
`HostTonightPrompt` (bottom drawer that replaces the mobile tab bar,
same as `PartySheet` on the map; hosts/admins once per day Wed–Sat,
everyone else once on Friday; swipe down or Escape to dismiss — no ✕;
hosts go to `/create`, everyone else to `/become-host`).

## Card anatomy (the feed)

Both cards share one props contract — `FeedCardProps`, exported from
`PartyCard.tsx`. Pages build one props object per party and pick a card.

- **HeadlinerCard** (the night's top party): full-width StagePoster, badge row
  (`HEADLINER` yellow + category chip), uppercase title, host, time ·
  address(gate) + votes, full-width GOING bar + navigate.
- **PartyCard** (everything else): 42% poster pane, category chip + chevron,
  title, host, time + votes on one left-grouped row, GOING bar + navigate.
  No fixed height — content sizes the card. No address on the card (the
  detail page owns it).

Interaction rule: **the whole card is one tap target** (stretched invisible
Link, z-1) opening `/party/[id]`; only the GOING/navigate action row floats
above it (z-2). Vote rows on cards are read-only — rating happens on the
detail page. Never nest a `<button>` inside a `<Link>` (§8.9).

## Party detail page (WF-D)

Pushed route: back arrow over the hero, no mobile tab bar
(`AppShell hideBottomNav`), sticky action bar (GOING 70% / navigate 30%;
ticketed = GOING outline + BUY TICKETS primary). Order: hero → tags
(`HEADLINER` when `isHeadliner`, category) → title → HostRow (cred line from
the leaderboard RPC when host_codes are linked) → WhenWhereCard (date · time
· address stacked; map button deep-links `/map?party=<id>`; logged-out sees
"Log in to view address") → StatTiles (COVER/TICKETS · GOING · SHARE) → PromoCard →
FROM THE HOST → RatingPanel (inline vote buttons; going-only enforced
server-side, surfaced as toast, never preached in copy) → sticky bar.

## System rules

1. **One glow.** Only the HEADLINER badge glows (`shadow-hyped-glow`).
2. **Soft-gate nulls stay null.** Server-stripped counts render as dashes or
   count-less labels ("GOING"), never fake zeros. The address is the carrot;
   everything else stays browsable logged out.
3. **No live blur.** `backdrop-filter` is banned on scrolling surfaces;
   StagePoster's wings are a one-time CSS filter on a static img (pre-bake
   seam documented in the component if perf ever complains).
4. **Chips are square-ish.** 4px corners on all badge chips; full-round is
   reserved for the compact GOING pill and avatars.
5. **Map pins and the sheet mirror cards.** Pin CSS in `globals.css`
   consumes the same `--temple-*` vars (the headliner ★ is the HEADLINER
   badge, pin-sized); the party sheet is plain kit components. Only the
   sponsor pin still uses a Leaflet popup.
6. **Forms mirror server validation, in friendlier words.** The server 422 is
   the backstop, never the UX: rules a host can hit get checked client-side
   with a human sentence under the field (ticket link https rule in
   `utils/ticketUrl.ts`, promo code+label pairing, grad-year list). Helpful
   fixes are applied for them (bare domain → https:// prepended); explicit
   mistakes are explained, never silently rewritten (http:// stays an error).

## Decision log

| Date | Decision |
|---|---|
| 2026-08-17 | Palette locked: purple/black/light-purple + yellow HYPED only; cyan rejected, green retired (owner) |
| 2026-08-17 | Wordmark: Montserrat `tuparties`, purple `tu` (owner) — Bitcount retired from chrome |
| 2026-08-17 | Stage wings: CSS blur, no server pre-bake (owner) |
| 2026-08-17 | Ratings: RSVP-gated server-side; UI mentions it only via toast on attempt (owner) |
| 2026-08-17 | Vote glyphs: reddit-style arrows, icon-only fill in secondary when cast (owner; thumbs tried and rejected) |
| 2026-08-17 | Compact card: classic v1 layout (42% poster) with new skin; no address/icons; whole card tappable (owner) |
| 2026-08-17 | Badge copy: `HEADLINER` (was HYPED · TONIGHT'S HEADLINER); category chip joins it on hero + detail |
| 2026-08-17 | Detail page gets `isHeadliner` from the server (top going_count of its night) |
| 2026-08-17 | Map popups repainted to the card language: one chip (HEADLINER wins over category), surface-2, read-only VoteRow, no address row; going/nav bar keeps its fused shape |
| 2026-08-17 | Map day filter = the same SegmentedTabs as home, floating over the map |
| 2026-08-17 | Sponsor system revived (owner): home slot + map pin/popup, all driven by `lib/sponsors.ts` (empty array = everything off); text banner + nightly reminder stay retired |
| 2026-08-17 | Rankings: dropdown filter kept (owner rejected stacked tabs), champion hero (#1 on the 280px stage w/ gold `#1 · <period>` chip), medal rank colors (gold/light-purple/purple), rows as linked cards |
| 2026-08-17 | Profile: identity card + role-aware CTA stack (Host profile row ABOVE Create a party), grouped details card, `LIVE`/`IN REVIEW`/`REJECTED` listing chips |
| 2026-08-17 | school_year became GRAD YEAR ("Class of 2028"), onboarding heading "Class of"; legacy class-standing values still accepted server-side |
| 2026-08-17 | Become-a-host = WF-BH 3-step (pitch → org → CLAIM/pending), vertically centered (`my-auto`, never `justify-center` — it clips overflow) |
| 2026-08-17 | Host org identity: approved application locks the posting host name and gates the Frat Party category (server-enforced); read-only `/host` page is the future paid-tier seam |
| 2026-08-17 | AddressAutocomplete extracted to the kit — create-party + become-host share it |
| 2026-08-17 | Poster upload preview = 4:5 vertical, same ratio the app renders flyers |
| 2026-08-17 | Create form's last step = "Tickets": ticket link + price text + promo, all optional. Link validated client-side (`utils/ticketUrl.ts` mirrors the server's https-only rule; bare `posh.vip/…` gets https:// glued on; explicit http:// errors instead of rewriting) — a saved link is what flips the party page to WF-D2 BUY TICKETS |
| 2026-08-17 | Promo entry hides behind a DashedCard disclosure — the dashed coupon cue previews the party-page PromoCard. Code uppercases as typed (it IS the string people copy); code+deal are required together (server pairing rule, checked in the form first); closing the disclosure clears all three fields |
| 2026-08-17 | Ticketed party with no price text reads `ONLINE / TICKETS` on the stat tile — `FREE / TICKETS` next to a BUY TICKETS bar would lie |
| 2026-08-22 | Host-line marks redrawn (owner: old pair "sucks"): VerifiedMark is one inline SVG seal (12 scallops, secondary fill, black check, 15px) replacing two pixel-nudged `<img>`s; last-semester `#1` is a bare 16px gold crown glyph after the seal (a filled gold chip was tried and rejected by the owner as too button-like); cards/HostRow/map popup all use 4px gaps, marks carry no margin |
| 2026-08-21 | Party-page SHARE is the loudest secondary (TUP-9): a SHARE tile in the COVER / GOING row (iOS tray icon). Native share falls back to execCommand copy so Mobile Safari / Instagram WebView actually get the URL. |
| 2026-08-27 | Map locked to the party zone (owner): W York St → Girard Ave, 5th → 19th, as the smallest lat/lng box holding the four corner intersections; rubber-band edges; zoom-out floored at "zone fills the screen" per viewport (≈15.2 phone / ≈16 desktop); start view unchanged |
| 2026-08-27 | Cover tiles show data, not prose (owner: "$10 at the door" on a tile is wrong): `utils/coverPrice.ts` reads the amount out of the host's free text → tiles are only `FREE` / `$N` / `—` (party page keeps `ONLINE` for ticketed-with-no-price). Admin queue still shows the raw text |
| 2026-08-27 | Map pins + sheet from Figma §13 (owner): ring pin for **verified hosts only** (`isVerified` stands in for the paid tier — no backend gate yet), free hosts keep the disc; default brand = app palette via CSS vars until the picker ships. Leaflet popup → `PartySheet` bottom drawer. Sheet stats are STARTS / ENDS / COVER (WALK dropped — no location permission). House footprint glow and pin clustering deferred (no parcel data; zoom lock makes clusters rare) |
| 2026-08-27 | Map pin going-count is always a hanging pill badge (owner: phone couldn't read the in-circle number): same `pin-count-badge` on disc + ring, 11px above iOS text-size floor, Leaflet cell overflow visible |
| 2026-09-10 | Saturday host prompt: a floating (not modal) card rises from under the tab bar on Home during the Saturday 6 AM–Sunday 5:59 AM window. Same 6 AM rollover as `getDefaultDay`. No glow. Copy is always “post a party” (not become-a-host). Body is “N students are looking now, put it on the feed!” with N a 150–350 draw (no replacement until the deck is spent; locked per Saturday so it does not flicker). Hosts/admins still land on `/create`, everyone else on `/become-host`. Dismiss is a PartySheet-style grabber + swipe down (Escape still works; no ✕). Dismissal persists until next Saturday. `?host_prompt=1` forces it for QA. Material is Apple-style frost (`backdrop-filter` on a dedicated layer — allowed because this is a fixed overlay, not a scrolling surface). |
| 2026-09-10 | Host prompt cadence (owner): hosts/admins see it once per rolled day Wed–Sat; regulars once on Friday (Fri 6 AM–Sat 5:59 AM). Consume-on-reveal, keyed by user id so two accounts on one phone do not share the counter. Same sheet, swipe, looking-count, and CTA routing. |
| 2026-09-10 | Host prompt sheet sits on the bottom of the screen and replaces the mobile tab bar while open (same pattern as map `PartySheet`). Desktop top bar stays. |
| 2026-09-10 | Host prompt CTA is frost on primary (`#b24bf3` fill, specular edge, no glow) — no TONIGHT eyebrow. `prefers-reduced-transparency` stays solid `temple-purple`. |
