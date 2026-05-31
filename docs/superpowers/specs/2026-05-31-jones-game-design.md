# Jones in the Fast Lane (clone) — MVP Game Design

**Date:** 2026-05-31
**Status:** Approved design, pre-implementation

## Summary

Build a single-player, browser-based economic life-sim — an MVP clone of *Jones in the Fast Lane* — on top of the already-finished SVG board (`assets/board.svg`, formerly `jones2.svg`). The player spends a weekly budget of time units moving around a board of buildings to earn money, get educated, climb a career, and buy happiness, racing to hit target levels in four goal stats. Rules need not match the 1990 original exactly; buildings are reinvented freely (e.g. a Tesla dealership replacing the Pawn Shop, granting reduced travel time and weekend self-driving-taxi income).

The game logic is a **pure, framework-free TypeScript engine**. A thin **Svelte 5 (runes)** layer renders state and dispatches actions. This separation makes the engine unit-testable headless and lets a future LLM opponent (via OpenRouter) or multiplayer server drive the game through the same action API.

## Goals & Non-Goals

**Goals (MVP):**
- A complete, playable core loop: move → work/study/shop/bank → end week → win check.
- Four goal stats — **Wealth, Happiness, Education, Career** — with player-set targets; reaching all targets wins.
- Weekly time-unit budget; discrete waypoint-hop travel cost.
- Data-driven buildings so mechanics can be swapped/reinvented without engine changes.
- Pure engine with `bun test` coverage; Svelte UI verified by running it.

**Non-Goals (deferred):**
- AI opponents (OpenRouter) — architecture must not preclude, but not built now.
- Multiplayer / hotseat — state model is N-player-ready, but MVP runs one local human.
- Hard lose/game-over flow — failure is gentle (unpaid bills become debt).
- Real-time day schedules, shop open-hours.

## Players & Turns

- MVP: **one local human player.**
- `GameState.players` is an array and `current` is an index, so additional players (human or agent-driven) require no re-architecture.
- All player capabilities are expressed as **Actions** dispatched through one reducer — the single seam an AI agent or network client would later use.

## Architecture

**Approach: pure engine core + thin Svelte view.** The whole game is one serializable `GameState` object, evolved only by `applyAction(state, action) → newState`. The UI never mutates state directly; it calls `dispatch(action)`.

### Directory layout

```
game/
  engine/                  ← pure TypeScript, NO DOM, NO Svelte
    state.ts               ← GameState type + initial-state factory
    actions.ts             ← Action union type
    reducer.ts             ← applyAction(state, action) → newState (pure)
    economy.ts             ← wages, interest, rent, bills, happiness decay, promotions
    movement.ts            ← discrete waypoint-hop travel cost (+ travel multiplier)
    winCheck.ts            ← all goals met?
    rng.ts                 ← seeded deterministic RNG
  data/
    buildings.ts           ← building registry (data-driven configs)
    board.ts               ← board graph: nodes + edges (parsed from SVG waypoints)
    jobs.ts  courses.ts  items.ts   ← economy data tables
    config.ts              ← tunables: weekly time budget, starting cash, hop cost, goal targets
  ui/                      ← Svelte 5 layer (ONLY part touching the DOM)
    App.svelte
    Board.svelte           ← renders SVG, player token, hit-box click handlers
    DialogPanel.svelte     ← center cream panel; swaps in screens
    screens/               ← Home/HUD, BuildingScreen, JobScreen, ShopScreen, GoalsScreen…
    stores/game.svelte.ts  ← holds GameState in a rune, exposes dispatch()
  main.ts                  ← bootstraps the Svelte app

assets/
  board.svg                ← copy of jones2.svg (the final board)
  sprites/                 ← clean-named building + prop PNGs (from the old export/)

tools/                     ← relocated asset pipeline + editor
  index.ts generate.ts batch.ts batch-core.ts export-layout.ts layout.html
  batch.json batch.example.json jones_buildings.json props.json layout.json
  generated/

archive/                   ← jones.svg jones.png drawing-1.svg backup.svg jones.af

docs/                      ← specs (this file)
```

**The contract:** UI → `dispatch(action)` → store runs `applyAction` → Svelte re-renders from new state. That single choke point is the door for tests, AI opponents, and future multiplayer.

### Repo reorganization

Moving the asset pipeline out of the root is part of this work:
- Pipeline/editor files → `tools/`.
- Working/source art → `archive/`.
- `jones2.svg` copied to `assets/board.svg`; clean PNGs to `assets/sprites/`.
- After moving, fix relative paths in `export-layout.ts` / `layout.html` and **verify the editor still launches** (`bun tools/index.ts` or updated script).

## Core engine

### State

```ts
type Stat = "wealth" | "happiness" | "education" | "career";

interface Player {
  id: string;
  name: string;
  position: NodeId;        // current board node
  cash: number;            // money on hand
  bank: number;            // savings (weekly interest)
  debt: number;            // outstanding loan (weekly interest)
  happiness: number;
  education: number;       // points → unlocks career tiers
  careerLevel: number;     // job tier reached
  jobId: JobId | null;
  experience: number;      // progress toward promotion
  inventory: ItemId[];     // clothes / goods owned
  timeLeft: number;        // time units remaining this week
  travelMultiplier: number;// 1.0 default; <1 from vehicle perks
}

interface GameState {
  players: Player[];
  current: number;
  week: number;
  phase: "setup" | "playing" | "weekEnd" | "won";
  goals: Record<Stat, number>;   // target levels to win
  seed: number;
  log: LogEntry[];               // newspaper / event feed
}
```

**Wealth is derived** (`cash + bank − debt`) at goal-check time — never stored, so it can't drift.

### Actions

```ts
type Action =
  | { type: "setGoals"; goals: Record<Stat, number> }
  | { type: "moveTo"; node: NodeId }          // travel; cost = hops × hopCost × travelMultiplier
  | { type: "work" }                          // shift at your workplace
  | { type: "applyForJob"; job: JobId }       // employment office
  | { type: "takeClass"; course: CourseId }   // university
  | { type: "buy"; item: ItemId }             // any shop
  | { type: "bank"; op: "deposit"|"withdraw"|"loan"|"repay"; amount: number }
  | { type: "rent"; unit: HousingId }         // rent office / apartments
  | { type: "endWeek" };                       // settlement
```

The reducer **validates before applying** (enough time? enough money? standing at the right building?). On failure it returns the unchanged state plus a rejection reason; nothing partially applies.

## Board & movement

- The road is a single **loop**. **Waypoints** (to be added to the SVG) become ordered nodes; adjacent waypoints are connected by edges → a ring. Each building's hit box links to its nearest waypoint ("doorstep").
- **Travel = discrete waypoint hops.** Cost = number of hops between current node and destination doorstep × `hopCost` (config) × `player.travelMultiplier`, taking the shorter way around the ring (`min(cw, ccw)` — no heavy pathfinding).
- The token animates along waypoints for visual feedback only; the time cost is decided instantly at dispatch.
- `data/board.ts` defines the board-graph interface and a parser that reads waypoints from `assets/board.svg`. Until waypoints exist, tests use a small hand-built graph.

**Tesla perk hook:** purchasing a vehicle sets `player.travelMultiplier` (and registers a weekend income hook — see below). No other movement code changes.

## Buildings as data

A building is pure data: identity + the SVG hit box it owns + its doorstep node + a list of **services**.

```ts
interface Building {
  id: BuildingId;
  name: string;
  hitBoxId: string;     // matches an SVG "Hit-Box" element
  node: NodeId;         // doorstep waypoint
  services: Service[];
}
```

The engine understands a **small fixed set of service types**; buildings compose them:

| Service type | Example buildings | Effect |
|---|---|---|
| `workplace` | Factory, shops | offers jobs; `work` earns wages, costs time |
| `education` | University | `takeClass` → spend money+time, gain education |
| `hiring` | Employment Office | browse/apply for jobs |
| `shop` | Try & Save, Discount, Off the Rack, Frosty | `buy` items → happiness and/or clothing (clothing gates some jobs) |
| `bank` | Bank | deposit / withdraw / loan / repay |
| `housing` | Rent Office | rent a place (sets weekly rent) |
| `vehicle` *(future)* | Tesla dealership | sets `travelMultiplier`, registers weekend income hook |

Jobs, courses, and items are **data tables** (e.g. `jobId → {wage, timeCost, requiredEducation, requiredClothing}`) referenced by services. Tuning the economy = editing tables, not logic.

**Extensibility boundary:** compose with data; add a new service type (a small bit of engine code) only for a genuinely new mechanic. The weekend passive income is the one such seam in scope-adjacent territory — implemented as a `weekEndHooks` list that effects can register into.

## Week cycle & economy

During the **playing** phase the player spends time units. When `timeLeft` hits 0 or the player chooses "End Week," `endWeek` runs settlement in fixed order:

1. Bank interest → savings; loan interest → debt.
2. Rent due (if renting), paid from cash.
3. Weekend hooks fire (e.g. Tesla taxi income).
4. Career check: enough experience + education → promotion (raises career level & future wages).
5. Happiness decay (drifts down; must be maintained).
6. `timeLeft` resets to the weekly budget; `week++`.
7. Win check: all four goals met → phase `won`.

Each step appends to the news/event log so the player sees what happened over the weekend.

**Failure rule (gentle):** if cash can't cover rent/bills, the unpaid amount is **added to debt** and accrues interest. No game over.

## Win condition

At setup the player sets target levels for **Wealth, Happiness, Education, Career** (`GameState.goals`). The game is **won** when all four current values meet or exceed their targets, checked at each week-end.

## UI layer (Svelte 5)

- **Board.svelte** inlines `assets/board.svg`, overlays the player token, and attaches click handlers to the building **Hit-Box** elements. Board art stays untouched.
- **Layout direction A — everything in the center panel.** The center cream panel is the dashboard:
  - A slim **stats + money strip** at the top (4 goal bars showing progress toward target; cash / bank / debt; week + time-left).
  - Below it, the **home view** shows the newspaper/event feed by default.
  - Clicking a building swaps the panel **body** to that building's screen (job listings, course list, shop items, bank ops, housing).
- **stores/game.svelte.ts** holds `GameState` in a rune and exposes `dispatch(action)`; components render from state and never mutate it directly.
- Consult current Svelte 5 runes best practices (svelte-5 tooling) during implementation.

## Persistence

`GameState` is a plain serializable object: save = `JSON.stringify` to `localStorage`. Autosave at each week-end plus a manual Save; one slot for MVP; New Game resets. No extra design needed — falls out of the architecture.

## Testing

Engine-first, TDD with `bun test`:
- **reducer** — each action validates correctly (rejects on insufficient time/money/wrong building) and applies correct effects; no partial application.
- **economy** — interest, rent→debt, wages, happiness decay, promotions.
- **movement** — hop counts, shorter-way-around-the-ring, travel multiplier.
- **winCheck** — goals met / not met.
- Deterministic seeded RNG for repeatable tests.

The Svelte UI is verified by running the app (`/run`, `verify`). Engine correctness first; UI second.

## Open dependency

The board **waypoints** are not yet in `assets/board.svg`. `data/board.ts` defines the graph interface and parser now; real node/edge data is wired once the waypoints are added. Engine and tests proceed against a hand-built graph in the meantime.
