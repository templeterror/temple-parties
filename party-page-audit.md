# Party page audit (2026-11-09)

Run: `rafiat-design-exploration`, routed through `emil-ask-emil` → `emil-prototype` (undecided) + `emil-design-foundations`. Prototype at `/proto/party`. Reviewed live at 390×844 on `/demo/party/demo-fri-headliner`.

## What to call it

**Party page**, the pushed route `/party/[id]`. The Deck's `Details` button opens it.

## What it must do

1. Confirm the decision the Deck started: is this the one tonight? (flyer, who, when, cover, how many going)
2. Make the one action easy: `I'm going` (or `Buy tickets` for ticketed parties). Directions second. Share is the growth loop (TUP-9).
3. Hand over the carrots: the address and the promo code, both soft-gated for logged-out viewers.
4. After doors open, collect the vote ("Was it good?").
5. Speak the Deck's language. The Deck shipped on 2026-11-07 and the party page is the only surface that still uses the 08-17 skin.

## Before / After / Why

| Before | After | Why |
|---|---|---|
| The hero is `StagePoster` at a fixed height (`object-contain` on blurred wings, so it is not cropped), with wings filling the sides at 390px | Size the hero to the flyer's ratio, or make the flyer the full screen (Poster variant) | The flyer is the page's best content and renders smaller than the screen allows. *(Corrected: an earlier draft said it was cropped. It isn't.)* |
| `HEADLINER` glow chip + purple `OTHER` chip | The Quiet eyebrow: yellow `#1 tonight` text · muted category caps, with `Other` hidden | The 2026-11-08 Quiet decision. White on `#b24bf3` is 4.04:1 and fails, and "Other" carries no information |
| Title in 28px UPPERCASE | The title in the host's casing, balanced, with no forced caps | Same as the Deck. All caps at 28px wraps badly on long titles |
| The host is a full card holding only an avatar letter, a name, and a seal. Its subtitle repeats the category | A host line (seal, crown, `92% liked · 16 parties`) with no box | One fact doesn't need a container. Hierarchy is subtraction |
| Date and time sit in the card's top half as `FRI APR 10 · 10 PM` muted caps, with the address below | The facts use Deck wording: `Live now` / `Doors 10 PM` / `Ended`, the price, `6 min walk`, and the address with a map affordance | One vocabulary across the Deck, map sheet, and page |
| Three stat tiles: `FREE COVER`, `186 GOING`, and a filled light-purple `SHARE` tile | The tiles are removed. Cover goes in the facts, going sits by the CTA, and Share becomes a secondary icon button | 186 appears twice (the tile and the `GOING (186)` bar). The filled SHARE tile is a third loud block competing with GOING and directions. One primary per view |
| Sticky bar: `GOING (186)` purple 70% + light-purple navigate block 30% | `I'm going` / `Going ✓` as the single primary + a quiet directions button (+ share) | The Deck's controls. Two filled colour blocks side by side read as two primaries |
| The 13px description is at `white/70` under a 10px `FROM THE HOST` label | Body at 15px/22, `white/80`, max 65ch, under the Quiet label style | 13px body copy is too small on a phone. Foundations caps the measure at 65ch, not the 13px floor |
| The rating panel shows a bar with up/down counts and two 52×44 arrow buttons, and appears in every phase | Rating appears only when it matters (doors open → locked), and the result reads `90% liked · 64 votes` | Before doors, the panel is noise ("Unlocks at 10 PM"). The targets already meet 44px |
| Logged out: the address card reads "Log in to view address", and the promo is masked behind SIGN IN — two separate gates | One clear gate with one sentence: "Sign in with your .edu to see the address and promo code" | One carrot, one button. Two gates read like nagging |
| Desktop: everything in a single 576px column with the sticky bar spanning it | Desktop gets two columns (flyer sticky on the left, details on the right), or stays a single column on purpose | The page is shared to laptops via links. Today desktop is a stretched phone |
| The page doesn't say whether the party has started or ended (no phase) | Phase from `utils/partyDeck.ts` (`Live now`, `Ended`), with past nights swapping the CTA for the vote | The same model the Deck uses, which already exists and is tested |

## What others do

- **Partiful / Luma event pages:** poster or cover → title → host → date/time → location (often gated) → a single RSVP block → "who's going" social proof → description → comments. Guest list visibility is a host setting. These sources are third-party guides, not official docs.
- **Resident Advisor:** no usable source found, so it's not cited.
- **Pattern:** the RSVP action sits in one block with its count, not split across a tile and a button.

## Direction

1. The flyer is never cropped.
2. Deck vocabulary and Quiet labels throughout.
3. Exactly one filled primary on screen (`I'm going` or `Buy tickets`).
4. No duplicated numbers.
5. One soft gate.
6. Rating is phase-aware.
7. 44px targets, focus rings, `prefers-reduced-motion`, and safe-area padding on the bottom bar.

## Variants (`/proto/party`)

| # | Name | Axis |
|---|---|---|
| 1 | Current | baseline, unchanged |
| 2 | Deck | continuity: the Deck card, expanded into a page, with a list of facts instead of tiles |
| 3 | Ticket | structure: a ticket-stub card of facts, and two columns on desktop |
| 4 | Poster | immersion: a full-screen flyer, with the info on a sheet that scrolls up over it |

## Open questions for Rafiat

- Should Share stay "the loudest secondary" (TUP-9) or become an icon? The variants differ here on purpose.
- Should ticketed parties also show `I'm going`? Today they don't; the feed card handles it.
- A "who's going" row (friends' faces) would be the strongest social proof, but there is no friends graph yet.

## Sources

- [Partiful — App Store listing (guest list, comments)](https://apps.apple.com/app/id1662982304)
- [party.pro — Luma guide (show who's coming setting)](https://party.pro/luma/)
- `DESIGN.md` decision log: 2026-11-07 Deck, 2026-11-08 Quiet labels
- `emil-design-foundations` (one primary, hierarchy, 65ch, 44px, empty states)
