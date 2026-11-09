# Progress

> **OpenOwls SDD** — Living status document. Update this file at the end of every work session.
> Claude Code reads this first at the start of every new session to catch up on project state.
>
> Note: detailed security findings stay in local-only files (`supabase/SCHEMA_CAPTURE_NOTES.md`,
> `specs/version2/*`) — do not paste attack-surface writeups here (public repo).

## Current Phase

**Active Phase:** Phase 1 — Epics 0–9 done; Epic 4 (deferred design system) returned as the
WF-B2/WF-D repaint on `epic-8`; Epic 10 launch hardening remains

## Status Summary

Figma redesign (`tuparties Redesign` node 148-742) implemented on `epic-8`: WF-B2 home feed
(headliner marquee + compact tail cards, full-width day tabs, 4-tab bottom nav, yellow HYPED
accent) and WF-D party detail page (stage hero, host cred row, stat tiles, promo coupon,
logged-out address gate, inline rating panel, sticky action bar + WF-D2 BUY TICKETS variant).
New reusable kit in `frontend/src/components/ui/` + `components/party/`; design decisions
recorded in root `DESIGN.md`. Backend gained `doors_close` / `external_ticket_url` / promo
fields (schema 020, applied to DEV), `hostStats` + `isHeadliner` on GET /parties/{id}, the
going-only rating gate, and PATCH /parties/{id} with approved→pending re-review. The create
form's final step now collects the ticket link (WF-D2 trigger) and a promo code — hosts can
self-serve both; the schema-020 fields are reachable end to end.
Backend 221 / frontend 96 green; `npm run build` clean.
**Owner still needs:** everything in Blocked below (unchanged), plus schema 020 on prod at cutover.

---

## Completed

- [x] Epic 0 — Security & repo preconditions (2026-08-06)
- [x] Epic 1 — Stabilize the base (2026-08-07): tests/CI/env/deps (PR #65 / cherry-picked onto epic-2)
- [x] Epic 2 — Backend groundwork (2026-08-07): migrations on DEV, weekend authority, API envelope
- [x] Epic 3 — Auth activation (2026-08-07): OTP + profiles API + E2E token proof on DEV
- [x] Epic 5 — Routed pages skeleton (2026-08-09): route tree, BottomNav links, demo rebuilt thin
- [x] Epic 6 — Auth UI + onboarding (see to-do.md)
- [x] Epic 7 — Party experience: feed, map, party page, authed RSVP/ratings, soft gate
- [x] Epic 8 — Host self-service: create party + my listings
- [x] Epic 9 — Admin panel v2
- [x] Epic 4 (returned) — WF-B2/WF-D redesign of home + party page (2026-08-17): ui kit,
      tokens, yellow HYPED, party detail rebuild, hostStats, going-only rating gate

---

## In Progress

- [ ] Epic 10 — Launch hardening & cutover (10.1, 10.4, 10.7–10.13 open)

---

## Blocked

| Item | Reason | Owner |
|------|--------|-------|
| Prod apply 2.1–2.4 | Safe-early migrations written + on DEV; prod apply is owner-manual | Owner |
| Prod apply 2.6–2.7 | Cutover — blocked until Epic 10.1 | — |
| Dev Auth OTP template + Before User Created hook | MCP cannot flip Auth config; steps in `auth-otp-setup.md` | Owner |

---

## Up Next

- [ ] Repaint the remaining surfaces on the new system (leaderboards, profile, create,
      admin already restyled — verify against Figma sections 06–10 as they get designs)
- [ ] Epic 10 remaining tasks (cutover, RLS tighten, QA pass, launch checklist)

---

## Decisions / context (durable)

- **Dev vs prod:** agents use **dev** MCP/env; prod changes are owner-manual.
- **Never promote tuparties-dev → prod** (synthetic ratings).
- Backend `SUPABASE_ANON_KEY` is optional/unused (service key only).
- `GET /parties` now returns `{ weekendOf, fridayDate, saturdayDate, parties }`; frontend unwraps `.parties`.
- Cutover trigger on DEV means anon going deltas can fight trigger recounts if backend points at DEV — expected until 10.1 removes anon endpoints.
- **Auth (Epic 3):** email OTP via `POST /auth/otp/request` + `/auth/otp/verify`; profiles at `GET/PATCH /profiles/me`. `NEXT_PUBLIC_AUTH_V2` and `/auth/callback` retired. Code-entry UI is Epic 6.
- **Redesign accents (owner, 2026-08-17):** HYPED badge = yellow `#FFD60A` (the app's one glow, CSS vars in `globals.css` shared by components AND map-popup CSS); everything else stays purple — no cyan. Wordmark = bold Montserrat `tuparties` with purple `tu`. Stage blur wings = CSS blur (pre-bake seam left in `StagePoster`).
- **Rating gate (owner, 2026-08-17):** POST /ratings requires an RSVP row ("Going only") — server-enforced.
- **PATCH /parties/{id} re-review:** editing an approved listing flips it back to `pending` (spec 11.5).
- **Soft-gate null rule (frontend):** server-stripped counts stay `null` end-to-end so UI shows dashes/count-less labels, never fake zeros (`useParties.withLiveCount`, feed `feedCardProps`, party page).

---

## Session Log

| Date | What Was Done |
|------|---------------|
| 2026-11-07 | Home feed → `PartyDeck` (one party per screen, scroll-snap, rank strip; owner pick from `/proto/cards`) and nav chrome → floating **Dock** + slim Classic top (owner pick from `/proto/nav`, variant 5). Dock uses the Figma icons (idle masked white), Home-on-Home → #1 via `HomeReselectContext`; deck reserves bottom chrome via `data-bottom-chrome` instead of edge sniffing; pages pad with `--dock-clearance`. Header top = safe area (12px floor), tighter DayTabs. `/demo` Fri #1 flyer 246 → 294px @375×812, 151 → 195px @375×667. Sponsor slide switched off in the feed (owner; commented, not deleted). `SegmentedTabs` `transition-all` → colors. +6 tests (`bottomNav.test.tsx`) |
| 2026-08-27 (pm) | Map redesign from Figma §13 (custom pins + drawer): `utils/mapPins.ts` pure HTML builders (disc for free hosts, branded ring pin for verified hosts as the paid-tier stand-in; selected/going/headliner/live/over/muted states; host-entered text escaped — the old pin injected it raw), brand slots as CSS vars with `DEFAULT_HOST_BRAND`, zoom-ladder host chip at ≥ 16. Leaflet party popup replaced by `components/map/PartySheet` (drag-down close, drag-up / tap → party page, COVER / STARTS / SHARE tile row mirroring the party page, address + votes on one row, GOING + navigate — owner trimmed ENDS, the going line and the second navigate; hostStats hydrated from the detail endpoint). Map dims under the pins while open (Leaflet scrim pane), camera pans the pin above the sheet; deep link + TUP-10 featured pin open the sheet. Fixed fake-zero on gated pin counts. House glow / clustering / walk-time deferred per owner. +18 tests |
| 2026-08-27 | Map locked to the party zone (pre-req for custom pins / highlighted-house redesign): `PARTY_ZONE` box = smallest lat/lng rectangle holding 19th & York, 5th & York, 19th & Girard, 5th & Girard (OSM/Overpass nodes, edges rounded outward). `maxBounds` + viscosity 0 (rubber-band, owner's pick), `PartyZoneLock` sets a per-viewport fractional `minZoom` so the zone always fills the screen (≈15.2 phone, ≈16.2 desktop) and re-fits on `resize`; start view unchanged. 4 helper tests added (160 frontend green), build clean |
| 2026-08-17 (late) | Hosts can self-serve ticket links + promo codes in the create form (schema-020 fields finally reachable): "Tickets" step = link + price text + promo disclosure. New `utils/ticketUrl.ts` (client mirror of the server's https-only rule, 11 tests); promo code+deal pairing checked in-form, code uppercased as typed, DashedCard disclosure clears on close; party page tile shows `ONLINE / TICKETS` when link-without-price. `party_created` gains `has_ticket_url` / `has_promo`. 96 frontend green, build clean. Known gap: no edit UI yet — links can't be added to already-submitted parties |
| 2026-08-17 (night) | Full-surface repaint + host funnel on `epic-8`: Rankings (dropdown kept, champion stage hero, medal cards, `posterImage` on rankings API), Profile (identity card, role-aware CTA stack, status chips), map popups + day tabs to system, sponsor system revived (config-driven), Become-a-host WF-BH 3-step flow, host org identity (locked host name + Frat gate, server-enforced, `/host` read-only page), grad-year field, shared AddressAutocomplete, 4:5 poster preview. Strict build caught 3 dev-hidden errors (fixed). 221 backend / 85 frontend green, build clean |
| 2026-08-17 (pm) | Owner design iteration on `epic-8`: compact card back to classic 42%-poster layout (new skin, whole-card tap target, no address), reddit-style VoteArrow (fills secondary when cast), HEADLINER badge copy + category chips on hero/detail, server `isHeadliner`, WhenWhereCard (date/time/address + `/map?party=<id>` deep-link w/ PartyFocusHandler), sticky bar 70/30, rating copy softened, server-seeded own-vote on detail. Created root `DESIGN.md` (4.1). 216 backend / 85 frontend green, build clean |
| 2026-08-17 | WF-B2/WF-D redesign on `epic-8`: ui kit (`components/ui/` + `components/party/`), HeadlinerCard + compact PartyCard, party page rebuild (sticky bar, promo, gate, rating panel), hostStats endpoint, going-only gate, PATCH re-review, schema 020 fields kept from prior session; 214 backend / 85 frontend green |
| 2026-08-07 | Epic 3 on `epic-2`: OTP endpoints, profiles router, migration 0005 (trigger+hook fn), prove script PASS, retired AUTH_V2/callback |
| 2026-08-07 | Epic 2 on `epic-2`: migrations 0001–0004 on DEV; weekend.py; parties envelope + ratingOpen/Locked; 143 backend tests |
| 2026-08-07 | Epic 1 done on `pic2`: fixed red tests, CI workflow, env examples, pinned Python/deps |
| 2026-08-06 | Epic 0 closed (dev + prod baselines) |
| 2026-08-02 | Epic 0.2 done; planning_v2 / to-do established |
