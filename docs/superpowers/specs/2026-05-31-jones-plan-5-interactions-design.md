# Jones Plan 5 — Interactions & Persistence (Design)

**Date:** 2026-05-31
**Status:** Approved design, pre-plan
**Parent spec:** `2026-05-31-jones-game-design.md`
**Builds on:** Plans 1–4 (engine + real board + Svelte UI foundation), all merged to `main`.

## Summary

Plans 1–4 delivered a pure TS engine (9 actions, 88 passing tests), the real board wired to waypoints, and a Svelte 5 UI where clicking a building walks the player token along the ring. Plan 5 makes the game **fully playable in the browser**: set goals → act at buildings through center-panel screens → end the week → win, with the game state persisted to `localStorage`. It also fixes the carried-forward token-movement bug.

No engine changes are expected — every player capability already exists as a reducer action. Plan 5 is almost entirely the Svelte view layer plus one small pure UI helper (node→path-offset mapping) that gets unit tests.

## Goals & Non-Goals

**Goals:**
- Fix the token-movement animation so the token follows the road reliably.
- A goal-setup screen replacing the current auto-start.
- Center-panel screens for all six service types, driven by clicking buildings.
- End Week with a weekend settlement summary in the news feed.
- Win screen.
- `localStorage` autosave/load (one slot) + manual Save + New Game.

**Non-Goals (captured for later):**
- Graphics/art polish on the panel screens (rows are text+badges for now; punch-up is a later pass).
- AI opponent (OpenRouter) and multiplayer — architecture already supports, not built.
- Multiple save slots; hard game-over.

## A. Token-movement fix (isolated, done first)

**Problem:** `goTo` in `game/ui/stores/game.svelte.ts` walks the token by reassigning `tokenXY` for each node in `ringPath(...).slice(1)` with `await sleep(STEP_MS)` between, relying on the token's CSS transition. It *frequently* slides in one straight chord instead of stepping through waypoints — a reactivity/scheduler/timing race, not a deterministic geometry bug.

**Fix:** Animate along the actual `Road` SVG path instead of jumping between node coordinates.
- Precompute, once, each ring node's offset along the `Road` path length (nearest-point on path to each `NODE_XY`, via sampling `getPointAtLength` over `getTotalLength`). This is a **pure function** given the path samples and node coords → unit-testable.
- On a move, tween the path offset from the current node's offset to the target's (shorter way around the loop, matching engine `hopsBetween` direction) using `requestAnimationFrame`; position the token with `getPointAtLength(offset)`.
- The token now follows the road curve regardless of hop count. The engine still charges time **instantly at dispatch** — animation is purely cosmetic and cannot affect state.

## B. Panel screen framework

A single `screen` value in the UI store selects the panel body:
- `"goals"` — goal-setup (game start / New Game, no save present).
- `"home"` — default during play: news feed + End Week.
- a **building id** — that building's service screen (set when a building is clicked).
- `"won"` — win screen.

`DialogPanel.svelte` switches on `screen`. The existing stats strip (`Hud`) stays pinned at the top of the panel for `home`, building, and `won` states. Clicking a building both **walks the token there and opens its screen**; a "◂ Home" link returns to `home`. The board art and the stats strip are untouched by screen swaps.

## C. The six service screens

A shared row-list component renders each screen: a header (`icon name` + "◂ Home"), then a list of action rows. Each row shows a name, an optional requirement/detail subtitle, and badges for **effect**, **⏳ time**, and **$ cost**. A row is **disabled/greyed when the reducer would reject it** (insufficient time/money, unmet requirement, wrong building) so invalid actions can't be clicked. Any rejection that still occurs surfaces in the existing error line.

| Screen | Source data | Rows | Action |
|---|---|---|---|
| workplace | player's current job | "Work a shift" (wage/time badges), repeatable while time remains | `work` |
| hiring | jobs table | job listings, requirement subtitles | `applyForJob` |
| education | courses table | course list | `takeClass` |
| shop | items table (per shop) | item list | `buy` |
| housing | housing table | units + weekly rent | `rent` |
| bank | — | four ops: deposit / withdraw / loan / repay, **each with an amount stepper/field** + a Do button | `bank` |

**Bank is the one exception** to pure row-click: it needs an amount input per op.

The mapping from a clicked building to its screen comes from the building's `services` (`game/data/buildings.ts`); a building with multiple services shows them in sections (rare in current data, but supported).

## D. Goal setup

Replaces the current auto-start. Four steppers (Wealth/Happiness/Education/Career) seeded from `CONFIG.defaultGoals`, plus Easy/Normal/Hard presets that fill all four. **Start** dispatches `setGoals` and moves phase `setup → playing`, screen → `home`.

## E. End Week + weekend summary

The **End Week** button on the home screen dispatches `endWeek`. The settlement steps already append `LogEntry`s (interest, rent→debt, weekend hooks, promotion, happiness decay); these render in the newspaper feed so the player sees what happened over the weekend. If `endWeek` triggers a win, screen → `won`.

## F. Persistence

`GameState` is plain serializable JSON. 
- **Autosave** the full state to `localStorage` (one slot key) at every week-end, plus a **manual Save**.
- **On boot:** if a save exists, load it (resume at its phase/screen); otherwise show goal-setup.
- **New Game** clears the slot and returns to goal-setup.

Save/load lives in the UI store as thin `JSON.stringify`/`parse` helpers; no engine change. A schema/version key guards against loading incompatible old saves (discard → fresh game).

## G. Testing

- Engine is already covered (88 tests); no new engine tests expected.
- The **node→path-offset mapping** helper is pure → gets `bun test` coverage (offsets monotonic around the loop, nearest-point correctness on a known path).
- UI verified by running it: `bun run ui:dev`, manual play of a full week to a win; gates `bun run ui:check` (svelte-check) and `bun run ui:build` must pass.

## Files (anticipated)

- `game/ui/stores/game.svelte.ts` — add `screen` state, `endWeek`/save/load/newGame, replace token walk with path-offset tween.
- `game/ui/DialogPanel.svelte` — new; body switch.
- `game/ui/screens/` — new: `GoalsScreen`, `HomeScreen`, `BuildingScreen` (shared row-list) + bank amount variant, `WinScreen`.
- `game/ui/lib/pathWalk.ts` (or similar) — pure node→path-offset mapping + tween helper; sibling `.test.ts`.
- `game/data/board.ts` — possibly export `Road` path id / sampling helper if needed.
- `App.svelte` — mount `DialogPanel` in the panel region (replacing direct `Hud`), keep stats strip pinned.

## Open dependency

Reads the `Road` path from `assets/board.svg` (already present and validated by `tools/svg-check.html`). No new art needed.
