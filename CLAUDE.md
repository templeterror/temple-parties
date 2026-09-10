# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Temple Party Finder (tuparties.com) — party discovery app for Temple University students. Two independent apps: a Next.js 14 frontend (deployed on Vercel) and a FastAPI backend (deployed on Railway), with Supabase (PostgreSQL + Auth) as the database.

## Commands

### Frontend (run from `frontend/`)

```bash
npm run dev            # dev server on :3000
npm run build          # ALWAYS run before pushing — catches TS errors dev mode misses
npm run lint
npm test               # jest
npm run test:watch
npx jest src/__tests__/dateHelpers.test.ts        # single test file
npx jest -t "test name"                            # single test by name
```

### Backend (run from `backend/`)

```bash
make setup             # one-time: create venv, install deps, copy .env.example → .env
make run               # uvicorn app.main:app --reload on :8000
make test              # pytest (tests/ dir)
. venv/bin/activate && pytest tests/test_parties.py -k test_name   # single test
```

Env files: `frontend/.env.local` and `backend/.env` (both have `.env.example` templates with Supabase keys). Frontend expects `NEXT_PUBLIC_API_URL` pointing at the backend (defaults to `http://localhost:8000`).

## Git Workflow

- **Never push to remote.** The user handles all pushes and deploys. Commit locally only when asked.
- Run `npm run build` in `frontend/` before declaring frontend work done.

## Architecture

### Frontend is a single-page app with state-based views

`frontend/src/app/page.tsx` orchestrates everything via `currentView` state (`'home' | 'map' | 'rankings'`) — views are swapped, not routed. Modals (login, add party, invite, rating, profile) are managed through `useModalState`. Other routes:

- `/demo` — read-only snapshot of a past weekend; uses `useGoingStatus({ readOnly: true })` so demo interactions never mutate real counts or subscribe to realtime.
- `/admin` — party approval UI. Admin is enforced in application code only (`require_admin` in `routers/admin.py` reads `user_profiles.is_admin`); there is no RLS/policy/DB constraint backing it, and the backend uses the service-role key (bypasses RLS). `is_admin` is granted by hand in the Supabase dashboard — `set-username` hardcodes it to `false`.
- `/auth/callback` — magic link landing.
- `/login`, `/onboarding`, `/create`, `/profile`, `/party/[id]` — routed pages (Epic 5+).

**Auth + soft-gate:** Auth UI is live. Logged-out users can browse; going/rating/navigate/address reveal soft-gate to `/login` (`AUTH_GATE_ENABLED` in `useModalState`). RSVP and ratings are account-keyed via FastAPI (`POST/DELETE /parties/{id}/going`, `POST /ratings/{id}`) — anonymous write endpoints were removed in Epic 10.2. Live going counts use a Supabase realtime `postgres_changes` subscription in `useGoingStatus` (requires `parties` on the realtime publication — see Epic 10.4 runbook).

### All backend calls go through one service layer

`frontend/src/services/api.ts` exports `authApi`, `partiesApi`, etc. `fetchWithAuth()` attaches the Supabase session JWT as a Bearer token. Never call the backend directly from components — add methods here.

### Two Supabase clients with different keys

- Frontend (`frontend/src/lib/supabase.ts`, anon key): sends OTP / holds the session, realtime subscriptions. Auth goes frontend → Supabase directly for OTP; backend verifies JWTs on protected routes.
- Backend (`backend/app/database.py`, service key): verifies JWTs (`get_current_user` / `require_auth` in `routers/auth.py`) and does all DB reads/writes.

`AUTH file explained.md` at the repo root documents the full auth flow step by step.

### The weekend system

Parties are scoped to a Friday–Saturday weekend keyed by the Friday's date (`weekend_of`). The "which weekend" rule is reimplemented in **four** places that must stay in sync (a known source of drift):

- Backend: `get_current_weekend()` in `routers/parties.py` — US/Eastern; Sat/Sun/Mon resolve to the past Friday, Tue–Fri to the upcoming Friday.
- Frontend: `getUpcomingFridayISO()` in `utils/dateHelpers.ts` — browser-local; passed as `weekendOf` to the API. Note the "before 6 AM counts as the previous day" rule lives only in `getDefaultDay()` (which tab is pre-selected), not in the weekend key.
- `backend/seed_parties.py` `get_next_friday()` and `frontend/src/components/DatePicker.tsx` each carry their own copy.

The backend is US/Eastern while the frontend is browser-local, so the two can disagree for users outside ET.

### Backend structure

FastAPI app in `backend/app/`: routers (`auth`, `parties`, `admin`, `ratings`), Pydantic models in `models/`, `services/geocoding.py` (Nominatim, with fallback coordinates inside `TEMPLE_BOUNDS`). Rate limiting via slowapi covers **all write endpoints** (see `constants.py` `RATE_LIMITS`), including admin approve/reject and `DELETE /parties/{id}`. Limits are in-memory/per-process. CORS defaults to production domains only (`app/config.py`); local/dev must set `CORS_ORIGINS` (see `backend/.env.example`). Owner cutover/RLS/CORS steps: `specs/version2/epic-10-cutover.md`.

### Database schema is documentation, not migrations

`backend/schema/` holds numbered SQL files (`001_baseline.sql` …). They are **not auto-applied** — schema changes are made in the Supabase dashboard, then recorded as a new sequentially-numbered file. Host ranking math (Bayesian/Wilson scores) lives in SQL — see files 008–013.

v2 baseline captures: `supabase/migrations/0000_baseline_dev.sql` and `0000_baseline_prod.sql` (capture/reference only — do not re-apply blindly). Security review writeups (`SCHEMA_CAPTURE_NOTES.md`, `DEV_NEVER_PROMOTE.md`) are gitignored — local only; public repo. **Never promote `tuparties-dev` data/schema into prod** (synthetic ratings live there).

### Analytics

Use `trackEvent()` from `utils/analytics.ts` — it fires both Vercel Analytics and PostHog, deferred via `requestIdleCallback`, and never throws. Note: new custom PostHog events can take hours to appear in the PostHog dropdown.

## Styling

**`DESIGN.md` at the repo root is the design-system source of truth** (palette, tokens, kit inventory, card anatomy, system rules, decision log). The short version: black bg, purple `#b24bf3` primary, light purple `#e0d4ff` secondary, surfaces `#1a1a1d`/`#252528`, and a yellow `#FFD60A` HEADLINER badge — the app's ONE glow. Green and cyan are retired. The hyped accent lives as CSS vars in `globals.css` `:root` so the Leaflet popup CSS and Tailwind tokens (`temple.*`, `shadow-hyped-glow`) read the same values. Components use tokens, not raw hex.

The reusable kit is `frontend/src/components/ui/` plus party-page pieces in `components/party/`. Feed cards share one props contract: `FeedCardProps` (exported from `PartyCard.tsx`) feeds both the compact `PartyCard` and the marquee `HeadlinerCard`. Cards are whole-card tap targets (stretched Link, only the GOING/navigate row floats above); card vote rows are read-only — rating lives on the party page. The party page is a pushed route: `AppShell hideBottomNav` swaps the mobile tab bar for a `StickyActionBar`; its `isHeadliner`/`hostStats` come from `GET /parties/{id}`, and its map button deep-links `/map?party=<id>` (focus handled in `MapContent`). Soft-gate rule: server-nulled counts stay `null` through hooks and props so the UI shows dashes/count-less labels, never fake zeros. Map pins are raw HTML for Leaflet (`utils/mapPins.ts`, styled in `globals.css` — not Tailwind, because Leaflet renders them outside React); tapping one opens `components/map/PartySheet` (a bottom drawer — the party Leaflet popup is gone, only the sponsor pin still has one). Verified hosts get the branded `ring` pin (stand-in for the future paid tier), everyone else the purple `disc`. The map uses a soft Philadelphia city lock: `PARTY_ZONE` / `PARTY_ZONE_BOUNDS` in `utils/mapHelpers.ts` (kept in sync with backend `VALID_BOUNDS`) feed `maxBounds` (rubber-band edges) and `PartyZoneLock` floors zoom-out at "city fills the screen" per viewport — covers Temple, Fishtown, Drexel/UCity, Center City, and Lincoln Financial.

## Repo Notes

- `frontend_local_backup/` and `backend_local_backup/` are stale copies — never edit them.
- Ratings are binary thumbs up/down (`ThumbsRating`); `StarRating` is legacy.
- Root-level `.md` files (`host_rating.md`, `host_feature_migration.md`, etc.) are feature/design docs.
- Living build status: `progress.md`. Ordered v2 work: `specs/version2/to-do.md` (local-only / gitignored).
