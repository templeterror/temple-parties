# Ranks page audit (2026-11-09)

Run: `rafiat-design-exploration`, routed through `emil-ask-emil` → `emil-prototype` (undecided) + `emil-design-foundations` (foundation). Prototype at `/proto/ranks`.

## What to call it

**Ranks**, the name on the Dock tab. The page header currently says "Rankings" and the route is `/leaderboards`. That makes three names for one place. Use "Ranks" on screen. The route can stay.

## What it must do

1. Answer "which parties were actually good?" for a period: last weekend, this month, or this semester.
2. Answer "which hosts can I trust?" with the Wilson/Bayesian host leaderboard.
3. Make #1 feel like a win. Hosts screenshot this page, and it is the brag surface.
4. Be honest about thin data. A score from 6 votes is not a score from 64.
5. Feel like the same app as the Deck: flyers lead, Quiet labels, sentence case, tabular numbers.

## Before / After / Why

| Before | After | Why |
|---|---|---|
| Header says "Rankings", the Dock says "Ranks", and the route is `/leaderboards` | "Ranks" everywhere on screen | One name per place. The user taps "Ranks" and should land on "Ranks" |
| Every row is a bordered `surface-2` card, so 15 cards stack into 15 boxes | Rows sit on one surface or on none, separated by hairlines or space | Hierarchy is subtraction. A stack of boxes makes the list heavy and buries #1 |
| Ranks 4+ use `text-white/30` (≈2.1:1 on `#252528`), and #3 uses `temple-purple` on surface-2 (≈3.3:1) | Every rank number is legible (≥4.5:1). Podium emphasis comes from size or position, not low-contrast colour | The rank number is content, not decoration, so it fails WCAG today |
| Rows have no flyer (the Deck taught users to recognise parties by their flyer) | Rows carry the flyer thumb | Recognition over recall. The flyer is how students remember a party |
| The champion flyer sits on a fixed 280px stage (`object-contain` on blurred wings, so it is not cropped, but it renders small) | Size the flyer to its own 4:5 ratio, or show it as a thumb in the row | At 280px, a 4:5 flyer is ≈224px wide inside a 358px card, so the wings take more space than the art. *(Corrected: an earlier draft said the flyer was cropped. It isn't.)* |
| Titles are UPPERCASE and truncated to 1 line | Titles use the case the host wrote, clamped to 2 lines, balanced | Same rule as the Deck. Truncating "LATIN HEAT PERREO…" loses the party |
| `↑ 91% (64)`: an arrow glyph, a percentage, and an unlabeled number in parentheses | `91%` plus `64 votes`, or a bar, so the sample size is labeled | An unlabeled `(64)` reads as nothing. Sample size is what makes the score trustworthy |
| Rows under 5 ratings dim to `opacity-60` and show `—` | Unranked rows go in their own labeled group ("Not enough votes yet") instead of being dimmed in the middle of the list | Opacity-disabling fails contrast unpredictably, and a separate group explains why the row is there |
| Loading shows a spinner | A skeleton in the list's own shape | Skeletons hold the layout; a spinner collapses it |
| The dropdown trigger is a full-width 48px card with a rotating chevron, and the info "button" is a `span role=button` nested inside a `<button>` | A compact control in the header row, with the info button as a real sibling `<button>` | Nested interactive elements are invalid HTML and break screen readers. The filter shouldn't outweigh the content |
| The menu has no keyboard support (no Escape, no arrows), no `aria-expanded`, and no `aria-haspopup` | Use a real listbox/menu pattern, or native `<select>` semantics | A11y floor |
| The host list has no logo or monogram, and hosts aren't tappable | A monogram (the `logoUrl` fallback) and the same row anatomy as parties | Parity between the two modes. Host pages are future work, so rows stay non-links |
| `transition-opacity` dims the whole list while the menu is open | Drop it | It decorates without informing |
| The empty state says "No ranked parties for this period" | "No ratings yet for last weekend — votes open when doors do." plus a link to switch period | Empty states explain and offer a next step |

## What others do

- **Leaderboards in practice:** show the sample size next to the score, explain how the score is computed (collapsed is fine), and keep lists short and segmented. Change over time motivates more than static rank. This is practitioner guidance from blogs and forums, not rigorous studies, so the evidence is thin.
- **Ranking math:** Evan Miller, *How Not To Sort By Average Rating*, shows that raw positive % lets a 2–0 item beat 100–1. Party ranks sort by raw `like_percentage` and then `rating_count` (`backend/app/routers/ratings.py:216`), with a 5-vote floor applied only in the UI. Hosts already use Wilson/Bayesian. This is out of scope for a UI run, but it's an open question below.
- **Event apps (Partiful, Luma):** social proof is "N going" with faces. Rank pages in consumer apps (Letterboxd lists, Beli, Untappd top rated) lead with the artwork, use a big rank numeral, and put the score small.

## Direction

1. Flyers come back to every row. The page should look like the Deck's sibling.
2. The rank numeral is the strongest type on each row and legible at every position.
3. The score is shown with its sample size (`91%` · `64 votes`).
4. Unrated parties go in a separate labeled group, never dimmed.
5. One period control (the owner kept a single dropdown over stacked tabs on 2026-08-17). It's compact, sits in the header row, and has real menu semantics.
6. Hosts mode uses the same anatomy, with a monogram where the flyer goes.

## Variants (`/proto/ranks`)

| # | Name | Axis |
|---|---|---|
| 1 | Current | baseline, unchanged |
| 2 | Podium | celebration: top 3 on a flyer podium, then a slim list |
| 3 | Chart | typography and density: Billboard-style numerals, hairline rows, no cards |
| 4 | Wall | flyer-first grid: a 2-col poster wall with rank badges, like Letterboxd |

## Open questions for Rafiat

- Should party ranks move to the same Wilson lower bound the hosts use (backend change)? Today a 5–0 party at 100% would outrank a 91% party with 64 votes.
- "Rankings" → "Ranks" on the page header?
- Host rows: should they link anywhere yet (the `/host` page exists read-only)?

## Sources

- [Evan Miller — How Not To Sort By Average Rating](https://www.evanmiller.org/how-not-to-sort-by-average-rating.html)
- [UI/UX tip: show review count with ratings](https://vponamariov.kit.com/posts/ui-ux-tip-7)
- [Mambo docs — leaderboards (small, segmented)](https://docs.mambo.io/administrators/gamification/leaderboards)
- [Yu-kai Chou — effective leaderboards](https://yukaichou.com/advanced-gamification/how-to-design-effective-leaderboards-boosting-motivation-and-engagement/)
- `emil-design-foundations` (hierarchy, contrast, IA tabs, empty states, skeletons)
