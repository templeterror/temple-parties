# Dock icons audit (2026-11-09)

Routed by `emil-ask-emil` to `emil-design-foundations` and its `icons-and-illustrations.md` reference. `emil-prototype` follows only if a direction is still open after the audit.

## What's there

- **Code:** `components/BottomNav.tsx`.
  - Home, Map and Ranks use the Figma exports in `public/icons/*.svg`. The `-active` file is used as-is; idle is the same file drawn as a white CSS mask.
  - Profile has no Figma asset. It is a hand-drawn inline SVG (`ProfileIcon`).
- **Figma (`7cB9zFg7HP2geCXFdgaPRJ`):**
  - The only real icon source is the v1 "Nav button" instance (Main page, node `8:209`). It has three icons: Home and Map at 40×40, and "leaderboards" at 26×31.
  - The Assets v2 tab bar (`168:109`) uses grey 22px placeholder squares for all four tabs, Profile included.
  - There is no Profile icon anywhere in the file.

## Measured at the Dock's 22px box

| Icon | Drawn size | Stroke | Caps / joins | Active state |
|---|---|---|---|---|
| Home | 20.0 × 22.0 | 2.09px | round / round | filled light purple + purple stroke |
| Map | 22.0 × 20.2 | 1.92px | round / round | filled |
| Ranks | 18.8 × 22.0 | 2.23px | **butt / miter** | filled |
| Profile | ~13 × 12 glyph in a 22 box | **1.65px** | round / default | **none** (same outline, recoloured) |

The Figma exports keep a 3.5px stroke but use different viewBoxes (33.5×36.8, 40.2×36.8, 29.5×34.5). Fitting each one into 22px scales its stroke by a different amount.

## Before / After / Why

| Before | After | Why |
|---|---|---|
| Four stroke weights: 2.09 / 1.92 / 2.23 / 1.65px | One stroke for the set (≈2px at 22px) | Rule 1 and 7: the stroke has to match the size it renders at, and the set has to match itself. |
| Four optical sizes. Ranks is narrow, Map is short, and Profile is about half the visual mass of the others | One keyline grid (e.g. 24px grid, 20px live area), each glyph balanced optically | When sizes vary, the eye reads the small one as less important. Profile looks like an afterthought. |
| Profile is a different hand-drawn glyph from a different "library" | Profile drawn in the same set as the other three, in Figma | Rule 6: never mix icon families on one surface. |
| Profile has no filled active state; the other three fill when active | Every tab gets the same idle → active treatment | Rule 4: outline vs fill can go either way, but it has to be consistent. |
| Ranks has square (butt) caps and mitered corners; the rest are round | Round caps and joins everywhere | Rule 9: square caps read as unfinished next to round ones. |
| Ranks is an ascending bar chart (reads as "stats/growth") | A podium glyph (2 · 1 · 3), now that the Ranks page *is* a podium | Rule 13: one icon, one meaning. The tab should look like where it takes you. *(Open, your call.)* |
| The idle colour is baked into the SVG (`#0B0B0B` at 50%) and recovered with a white mask | Icons tinted by token (`currentColor` / mask over `temple-muted`) | Semantic tokens over colours inside asset files. Works today, but it's fragile. |

## The constraint

Your rule (memory: "use the ones identical in Figma") means the fix starts in Figma. Redrawing in code would break it. The Figma source has the same inconsistencies, so a clean export of what's there won't fix anything.

## Two ways to go

1. **Figma first.** Redraw the set in the Figma file on one grid: Home, Map, Ranks (bar chart or podium), Profile, each with idle and active versions. Then export and wire them in.
2. **Code prototype first.** Put 2–3 set directions behind a picker in the real Dock (e.g. *Normalised*: today's shapes on one grid; *Podium*: Ranks becomes a podium; *Solid*: fill-only actives). Once you pick, it gets drawn in Figma and exported.

## Then the rest of the app

The same pass covers the other icons in `public/icons`: bell, clock, map-pin, navigate, thumbs, divider. It also covers the inline ones: Deck/party page icons, `NavigateIcon`, `ShareIcon`, `VoteArrow`, and the 20px party-page list icons. Those are already a mixed family.
