# Jones Game — Plan 2: Economy & Actions

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the game fully playable headlessly: data-driven buildings + jobs/courses/items/housing, and the remaining actions (`work`, `applyForJob`, `takeClass`, `buy`, `bank`, `rent`, `endWeek`) with the full week-settlement loop, all driven through the existing `applyAction` reducer and covered by `bun test`.

**Architecture:** Builds on Plan 1's pure engine. Two structural changes: (1) the reducer's bare `graph` argument becomes a `World` context bundling the board graph + all data tables; (2) the reducer dispatches to one-file-per-action handlers under `game/engine/actions/` so each action stays focused and independently testable. Shared helpers (`ApplyResult`, `reject`, `updateCurrent`) move to `game/engine/result.ts`. Everything stays pure — no DOM/IO.

**Tech Stack:** Bun (`bun test`), TypeScript (strict, scoped to `game/`).

**Prerequisite:** Plan 1 merged to `main` (engine core: config, rng, board, state, movement, winCheck, reducer with `setGoals`/`moveTo`). Work on a new branch `game-economy`.

---

## Current state (from Plan 1, do not re-create)

- `game/data/config.ts` — `CONFIG` (weeklyTimeBudget 60, hopCost 5, startingCash 200, startingBank 0, defaultGoals).
- `game/data/board.ts` — `NodeId`, `BoardGraph`, `hopsBetween`, `testRing` (nodes `n0`..`n7`).
- `game/engine/state.ts` — `Stat`, `JobId`, `ItemId`, `Player`, `LogEntry`, `Phase`, `GameState`, `createGame({playerName,startNode,seed})`.
- `game/engine/movement.ts` — `travelCost(graph, from, to, multiplier?)`.
- `game/engine/winCheck.ts` — `wealthOf(p)`, `statValue(p,stat)`, `hasWon(state, playerIndex)`.
- `game/engine/reducer.ts` — `Action` (`setGoals`|`moveTo`), `ApplyResult`, `reject`, `updateCurrent`, `applyAction(state, action, graph)`.

`Player` fields (Plan 1): `id, name, position, cash, bank, debt, happiness, education, careerLevel, jobId, experience, inventory, timeLeft, travelMultiplier`.

---

## File Structure (this plan)

```
game/data/
  config.ts        ← MODIFY: add economy tunables
  jobs.ts          ← Create: Job type + JOBS table
  courses.ts       ← Create: Course type + COURSES table
  items.ts         ← Create: Item type + ITEMS table
  housing.ts       ← Create: Housing type + HOUSING table
  buildings.ts     ← Create: Service union, Building type, BUILDINGS, buildingAt(), hasService()
  world.ts         ← Create: assembles WORLD (graph + tables); makeWorld(graph)
game/engine/
  state.ts         ← MODIFY: add weeklyRent, housingId to Player + createGame
  result.ts        ← Create: ApplyResult, reject, updateCurrent (moved out of reducer.ts)
  world.ts         ← Create: World interface
  economy.ts       ← Create: pure settlement helpers + tests
  wages.ts         ← Create: wageFor(job, careerLevel) + tests
  reducer.ts       ← MODIFY: World arg; dispatch to action handlers; full Action union
  actions/
    setGoals.ts    ← Create (moved from reducer.ts) + reuse existing tests
    moveTo.ts      ← Create (moved from reducer.ts)
    work.ts        ← Create + test
    applyForJob.ts ← Create + test
    takeClass.ts   ← Create + test
    buy.ts         ← Create + test
    bank.ts        ← Create + test
    rent.ts        ← Create + test
    endWeek.ts     ← Create + test
  playthrough.test.ts ← Create: integration test (play to a win)
```

**Note on board wiring:** `buildings.ts` wires buildings to `testRing` nodes for now, exactly as Plan 1 established (engine runs against `testRing` until waypoints are added to `assets/board.svg`). The data tables below are a real, playable set sufficient to exercise every mechanic; the full 13-building board wiring is a separate data task once waypoints land.

---

## Task 1: Economy tunables

**Files:**
- Modify: `game/data/config.ts`

- [ ] **Step 1: Add economy fields to CONFIG**

Replace the contents of `game/data/config.ts` with:
```ts
// game/data/config.ts
// Central tunables. Adjusting the economy = editing this file, not logic.
export const CONFIG = {
  weeklyTimeBudget: 60, // time units available each week
  hopCost: 5,           // time units per waypoint hop traveled
  startingCash: 200,
  startingBank: 0,

  // Economy (Plan 2)
  bankInterestRate: 0.02,      // weekly interest earned on savings
  loanInterestRate: 0.05,      // weekly interest charged on debt
  happinessDecayPerWeek: 5,    // happiness lost each week-end
  applyJobTimeCost: 5,         // time units to apply for a job
  promotionExperience: 5,      // work shifts of experience needed per promotion
  educationPerCareerLevel: 20, // education required to reach each next career level
  careerWageBonus: 0.25,       // +25% wage per career level

  defaultGoals: {
    wealth: 5000,
    happiness: 100,
    education: 100,
    career: 5,
  },
} as const;
```

- [ ] **Step 2: Confirm nothing broke**

Run: `bun test`
Expected: still 24 pass (no behavior change yet).

- [ ] **Step 3: Commit**

```bash
git add game/data/config.ts
git commit -m "feat(engine): add economy tunables to config"
```

---

## Task 2: Extend Player with housing fields

**Files:**
- Modify: `game/engine/state.ts`
- Test: `game/engine/state.test.ts` (add assertions)

- [ ] **Step 1: Add a failing assertion to the starting-values test**

In `game/engine/state.test.ts`, inside the existing test `"createGame seeds one player with starting money and no time yet"`, add these two assertions just before its closing `});`:
```ts
  expect(p.weeklyRent).toBe(0);
  expect(p.housingId).toBeNull();
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun test game/engine/state.test.ts`
Expected: FAIL — `weeklyRent`/`housingId` are not on `Player`.

- [ ] **Step 3: Add the fields**

In `game/engine/state.ts`, add a `HousingId` type alias next to the other id aliases:
```ts
export type HousingId = string;
```
Add these two fields to the `Player` interface (after `inventory: ItemId[];`):
```ts
  weeklyRent: number;          // charged each week-end; 0 if no housing
  housingId: HousingId | null; // current rented place
```
In `createGame`, add to the `player` object (after `inventory: [],`):
```ts
    weeklyRent: 0,
    housingId: null,
```

- [ ] **Step 4: Run to verify it passes**

Run: `bun test game/engine/state.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add game/engine/state.ts game/engine/state.test.ts
git commit -m "feat(engine): add housing fields to Player state"
```

---

## Task 3: Data tables (jobs, courses, items, housing)

**Files:**
- Create: `game/data/jobs.ts`, `game/data/courses.ts`, `game/data/items.ts`, `game/data/housing.ts`
- Test: `game/data/tables.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// game/data/tables.test.ts
import { test, expect } from "bun:test";
import { JOBS } from "./jobs";
import { COURSES } from "./courses";
import { ITEMS } from "./items";
import { HOUSING } from "./housing";

test("each table is keyed by its entries' own id", () => {
  for (const [key, job] of Object.entries(JOBS)) expect(job.id).toBe(key);
  for (const [key, c] of Object.entries(COURSES)) expect(c.id).toBe(key);
  for (const [key, i] of Object.entries(ITEMS)) expect(i.id).toBe(key);
  for (const [key, h] of Object.entries(HOUSING)) expect(h.id).toBe(key);
});

test("tables are non-empty and have sane positive costs", () => {
  expect(Object.keys(JOBS).length).toBeGreaterThan(0);
  for (const job of Object.values(JOBS)) {
    expect(job.wage).toBeGreaterThan(0);
    expect(job.timeCost).toBeGreaterThan(0);
  }
  for (const c of Object.values(COURSES)) {
    expect(c.cost).toBeGreaterThanOrEqual(0);
    expect(c.educationGain).toBeGreaterThan(0);
  }
  for (const h of Object.values(HOUSING)) expect(h.weeklyRent).toBeGreaterThanOrEqual(0);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun test game/data/tables.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Create `game/data/jobs.ts`**

```ts
// game/data/jobs.ts
import type { JobId } from "../engine/state";

export interface Job {
  id: JobId;
  title: string;
  buildingId: string;        // where this job is worked (Building.id)
  wage: number;              // base pay per work shift (before career bonus)
  timeCost: number;          // time units per shift
  requiredEducation: number; // min education to be hired
}

export const JOBS: Record<JobId, Job> = {
  janitor: { id: "janitor", title: "Janitor", buildingId: "factory", wage: 80, timeCost: 15, requiredEducation: 0 },
  clerk:   { id: "clerk",   title: "Store Clerk", buildingId: "tryandsave", wage: 120, timeCost: 15, requiredEducation: 20 },
  engineer:{ id: "engineer",title: "Engineer", buildingId: "factory", wage: 220, timeCost: 20, requiredEducation: 60 },
};
```

- [ ] **Step 4: Create `game/data/courses.ts`**

```ts
// game/data/courses.ts
export type CourseId = string;

export interface Course {
  id: CourseId;
  name: string;
  cost: number;
  timeCost: number;
  educationGain: number;
}

export const COURSES: Record<CourseId, Course> = {
  basics:   { id: "basics",   name: "Adult Basics", cost: 50,  timeCost: 15, educationGain: 20 },
  business: { id: "business", name: "Business 101", cost: 120, timeCost: 20, educationGain: 25 },
  engineering: { id: "engineering", name: "Engineering", cost: 250, timeCost: 25, educationGain: 30 },
};
```

- [ ] **Step 5: Create `game/data/items.ts`**

```ts
// game/data/items.ts
import type { ItemId } from "../engine/state";

export interface Item {
  id: ItemId;
  name: string;
  cost: number;
  timeCost: number;
  happinessGain: number; // 0 if the item gives no happiness
  clothing: boolean;     // true if it counts as clothing
}

export const ITEMS: Record<ItemId, Item> = {
  burger:   { id: "burger",   name: "Frosty Burger", cost: 8,   timeCost: 5,  happinessGain: 6,  clothing: false },
  tv:       { id: "tv",       name: "Television",    cost: 300, timeCost: 5,  happinessGain: 25, clothing: false },
  suit:     { id: "suit",     name: "Business Suit", cost: 200, timeCost: 5,  happinessGain: 5,  clothing: true },
};
```

- [ ] **Step 6: Create `game/data/housing.ts`**

```ts
// game/data/housing.ts
import type { HousingId } from "../engine/state";

export interface Housing {
  id: HousingId;
  name: string;
  weeklyRent: number;
}

export const HOUSING: Record<HousingId, Housing> = {
  lowcost:  { id: "lowcost",  name: "Low Cost Housing", weeklyRent: 40 },
  highsec:  { id: "highsec",  name: "High Security Apartments", weeklyRent: 120 },
};
```

- [ ] **Step 7: Run to verify it passes**

Run: `bun test game/data/tables.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 8: Commit**

```bash
git add game/data/jobs.ts game/data/courses.ts game/data/items.ts game/data/housing.ts game/data/tables.test.ts
git commit -m "feat(data): add jobs, courses, items, housing tables"
```

---

## Task 4: Building registry

**Files:**
- Create: `game/data/buildings.ts`
- Test: `game/data/buildings.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// game/data/buildings.test.ts
import { test, expect } from "bun:test";
import { BUILDINGS, buildingAt, hasService } from "./buildings";
import { testRing } from "./board";

test("every building sits on a real ring node", () => {
  for (const b of BUILDINGS) expect(testRing.nodes).toContain(b.node);
});

test("buildingAt finds the building on a node, or undefined", () => {
  const bank = BUILDINGS.find((b) => b.id === "bank")!;
  expect(buildingAt(BUILDINGS, bank.node)?.id).toBe("bank");
  const empty = testRing.nodes.find((n) => !BUILDINGS.some((b) => b.node === n));
  if (empty) expect(buildingAt(BUILDINGS, empty)).toBeUndefined();
});

test("hasService detects a service kind on a building", () => {
  const bank = BUILDINGS.find((b) => b.id === "bank")!;
  expect(hasService(bank, "bank")).toBe(true);
  expect(hasService(bank, "shop")).toBe(false);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun test game/data/buildings.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `game/data/buildings.ts`**

```ts
// game/data/buildings.ts
import type { NodeId } from "./board";
import { testRing } from "./board";
import type { JobId } from "../engine/state";
import type { CourseId } from "./courses";
import type { ItemId } from "../engine/state";
import type { HousingId } from "../engine/state";

export type Service =
  | { kind: "workplace" }                       // jobs reference this building via Job.buildingId
  | { kind: "hiring"; jobIds: JobId[] }         // apply for these jobs here
  | { kind: "education"; courseIds: CourseId[] } // take these courses here
  | { kind: "shop"; itemIds: ItemId[] }         // buy these items here
  | { kind: "bank" }                            // deposit/withdraw/loan/repay
  | { kind: "housing"; housingIds: HousingId[] }; // rent these places here

export type ServiceKind = Service["kind"];

export interface Building {
  id: string;
  name: string;
  hitBoxId: string; // matches an SVG "Hit-Box" element (used by the UI in Plan 3)
  node: NodeId;
  services: Service[];
}

// Wired to testRing nodes for now (real waypoint nodes land with the SVG waypoint task).
export const BUILDINGS: Building[] = [
  {
    id: "factory", name: "Factory", hitBoxId: "Hit-Box18", node: "n0",
    services: [{ kind: "workplace" }],
  },
  {
    id: "tryandsave", name: "Try and Save", hitBoxId: "Hit-Box6", node: "n1",
    services: [{ kind: "workplace" }, { kind: "shop", itemIds: ["burger", "tv", "suit"] }],
  },
  {
    id: "employment", name: "Employment Office", hitBoxId: "Hit-Box20", node: "n2",
    services: [{ kind: "hiring", jobIds: ["janitor", "clerk", "engineer"] }],
  },
  {
    id: "university", name: "University", hitBoxId: "Hit-Box24", node: "n3",
    services: [{ kind: "education", courseIds: ["basics", "business", "engineering"] }],
  },
  {
    id: "bank", name: "Bank", hitBoxId: "Hit-Box4", node: "n4",
    services: [{ kind: "bank" }],
  },
  {
    id: "rentoffice", name: "Rent Office", hitBoxId: "Hit-Box16", node: "n5",
    services: [{ kind: "housing", housingIds: ["lowcost", "highsec"] }],
  },
];

// Defensive: ensure every building node exists on the ring (catches mis-wiring early).
for (const b of BUILDINGS) {
  if (!testRing.nodes.includes(b.node)) {
    throw new Error(`Building ${b.id} wired to unknown node ${b.node}`);
  }
}

export function buildingAt(buildings: Building[], node: NodeId): Building | undefined {
  return buildings.find((b) => b.node === node);
}

export function hasService(building: Building, kind: ServiceKind): boolean {
  return building.services.some((s) => s.kind === kind);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `bun test game/data/buildings.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add game/data/buildings.ts game/data/buildings.test.ts
git commit -m "feat(data): add building registry with services"
```

---

## Task 5: World context + reducer refactor

This task introduces the `World` context, moves shared helpers to `result.ts`, moves `setGoals`/`moveTo` into `actions/`, and rewrites `reducer.ts` to dispatch by action type. The existing `reducer.test.ts` is updated to pass a `World` instead of a bare graph. No new game behavior — pure refactor — so the existing reducer tests must still pass.

**Files:**
- Create: `game/engine/world.ts`, `game/engine/result.ts`, `game/data/world.ts`, `game/engine/actions/setGoals.ts`, `game/engine/actions/moveTo.ts`
- Modify: `game/engine/reducer.ts`, `game/engine/reducer.test.ts`

- [ ] **Step 1: Create the World interface — `game/engine/world.ts`**

```ts
// game/engine/world.ts
import type { BoardGraph } from "../data/board";
import type { Building } from "../data/buildings";
import type { Job } from "../data/jobs";
import type { Course } from "../data/courses";
import type { Item } from "../data/items";
import type { Housing } from "../data/housing";
import type { JobId, ItemId, HousingId } from "./state";
import type { CourseId } from "../data/courses";

// Everything the reducer needs to know about the world, bundled into one arg.
export interface World {
  graph: BoardGraph;
  buildings: Building[];
  jobs: Record<JobId, Job>;
  courses: Record<CourseId, Course>;
  items: Record<ItemId, Item>;
  housing: Record<HousingId, Housing>;
}
```

- [ ] **Step 2: Create the assembled world — `game/data/world.ts`**

```ts
// game/data/world.ts
import type { World } from "../engine/world";
import type { BoardGraph } from "./board";
import { testRing } from "./board";
import { BUILDINGS } from "./buildings";
import { JOBS } from "./jobs";
import { COURSES } from "./courses";
import { ITEMS } from "./items";
import { HOUSING } from "./housing";

// Assemble a World from a board graph + the data tables.
export function makeWorld(graph: BoardGraph): World {
  return { graph, buildings: BUILDINGS, jobs: JOBS, courses: COURSES, items: ITEMS, housing: HOUSING };
}

// Default world used by tests and (until waypoints land) the app: tables on testRing.
export const WORLD: World = makeWorld(testRing);
```

- [ ] **Step 3: Create shared result helpers — `game/engine/result.ts`**

```ts
// game/engine/result.ts
import type { GameState, Player } from "./state";

export interface ApplyResult {
  state: GameState;
  ok: boolean;
  reason?: string;
}

export function ok(state: GameState): ApplyResult {
  return { state, ok: true };
}

export function reject(state: GameState, reason: string): ApplyResult {
  return { state, ok: false, reason };
}

// Immutably replace the current player with the result of `fn`.
export function updateCurrent(state: GameState, fn: (p: Player) => Player): GameState {
  const players = state.players.map((p, i) => (i === state.current ? fn(p) : p));
  return { ...state, players };
}
```

- [ ] **Step 4: Create `game/engine/actions/setGoals.ts`**

```ts
// game/engine/actions/setGoals.ts
import type { GameState, Stat } from "../state";
import type { World } from "../world";
import { type ApplyResult, ok, reject, updateCurrent } from "../result";
import { CONFIG } from "../../data/config";

export interface SetGoalsAction {
  type: "setGoals";
  goals: Record<Stat, number>;
}

export function setGoals(state: GameState, action: SetGoalsAction, _world: World): ApplyResult {
  if (state.phase !== "setup") {
    return reject(state, "Goals can only be set during setup.");
  }
  const started: GameState = { ...state, goals: { ...action.goals }, phase: "playing" };
  return ok(updateCurrent(started, (p) => ({ ...p, timeLeft: CONFIG.weeklyTimeBudget })));
}
```

- [ ] **Step 5: Create `game/engine/actions/moveTo.ts`**

```ts
// game/engine/actions/moveTo.ts
import type { GameState } from "../state";
import type { NodeId } from "../../data/board";
import type { World } from "../world";
import { type ApplyResult, ok, reject, updateCurrent } from "../result";
import { travelCost } from "../movement";

export interface MoveToAction {
  type: "moveTo";
  node: NodeId;
}

export function moveTo(state: GameState, action: MoveToAction, world: World): ApplyResult {
  if (state.phase !== "playing") {
    return reject(state, "Can only move while playing.");
  }
  if (!world.graph.nodes.includes(action.node)) {
    return reject(state, `Unknown node: ${action.node}`);
  }
  const player = state.players[state.current];
  const cost = travelCost(world.graph, player.position, action.node, player.travelMultiplier);
  if (cost > player.timeLeft) {
    return reject(state, "Not enough time to travel there.");
  }
  return ok(updateCurrent(state, (p) => ({ ...p, position: action.node, timeLeft: p.timeLeft - cost })));
}
```

- [ ] **Step 6: Rewrite `game/engine/reducer.ts` to dispatch**

Replace the entire contents of `game/engine/reducer.ts` with:
```ts
// game/engine/reducer.ts
import type { GameState } from "./state";
import type { World } from "./world";
import { type ApplyResult, reject } from "./result";
import { setGoals, type SetGoalsAction } from "./actions/setGoals";
import { moveTo, type MoveToAction } from "./actions/moveTo";

export type Action = SetGoalsAction | MoveToAction;
// More action variants are added to this union as their handlers land (work, buy, …).

export { type ApplyResult } from "./result";

export function applyAction(state: GameState, action: Action, world: World): ApplyResult {
  switch (action.type) {
    case "setGoals":
      return setGoals(state, action, world);
    case "moveTo":
      return moveTo(state, action, world);
    default: {
      const _exhaustive: never = action;
      return reject(state, `Unknown action: ${(_exhaustive as { type: string }).type}`);
    }
  }
}
```

- [ ] **Step 7: Update `game/engine/reducer.test.ts` to use a World**

Change the import block at the top of `game/engine/reducer.test.ts` — replace:
```ts
import { testRing } from "../data/board";
```
with:
```ts
import { WORLD } from "../data/world";
```
Then replace every occurrence of `testRing` in that file with `WORLD`. (There are six `applyAction(..., testRing)` calls — all become `applyAction(..., WORLD)`.)

- [ ] **Step 8: Run the affected tests**

Run: `bun test game/engine/reducer.test.ts`
Expected: PASS (6 tests) — same behavior, new plumbing.

- [ ] **Step 9: Run the whole suite + typecheck**

Run: `bun test && bunx tsc --noEmit -p tsconfig.json`
Expected: all tests pass; tsc exits 0.

- [ ] **Step 10: Commit**

```bash
git add game/engine/world.ts game/engine/result.ts game/data/world.ts \
        game/engine/actions/setGoals.ts game/engine/actions/moveTo.ts \
        game/engine/reducer.ts game/engine/reducer.test.ts
git commit -m "refactor(engine): introduce World context and per-action handlers"
```

---

## Task 6: Wage calculation

**Files:**
- Create: `game/engine/wages.ts`
- Test: `game/engine/wages.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// game/engine/wages.test.ts
import { test, expect } from "bun:test";
import { wageFor } from "./wages";
import type { Job } from "../data/jobs";

const job: Job = { id: "x", title: "X", buildingId: "b", wage: 100, timeCost: 10, requiredEducation: 0 };

test("wage at career level 0 is the base wage", () => {
  expect(wageFor(job, 0)).toBe(100);
});

test("each career level adds the configured bonus", () => {
  // 100 × (1 + 2 × 0.25) = 150
  expect(wageFor(job, 2)).toBe(150);
});

test("wage is rounded to a whole number", () => {
  // 100 × (1 + 1 × 0.25) = 125 (already whole); use a base that would fraction
  const j2 = { ...job, wage: 90 };
  // 90 × (1 + 1 × 0.25) = 112.5 → 113
  expect(wageFor(j2, 1)).toBe(113);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun test game/engine/wages.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// game/engine/wages.ts
import type { Job } from "../data/jobs";
import { CONFIG } from "../data/config";

// Pay for one shift, boosted by career level.
export function wageFor(job: Job, careerLevel: number): number {
  return Math.round(job.wage * (1 + careerLevel * CONFIG.careerWageBonus));
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `bun test game/engine/wages.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add game/engine/wages.ts game/engine/wages.test.ts
git commit -m "feat(engine): add career-scaled wage calculation"
```

---

## Task 7: Action — work

A `work` shift requires: phase playing, the player has a job, the player is standing at that job's building, and enough time. It pays the career-scaled wage, costs the job's time, and adds 1 experience.

**Files:**
- Create: `game/engine/actions/work.ts`
- Modify: `game/engine/reducer.ts` (register the action)
- Test: `game/engine/actions/work.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// game/engine/actions/work.test.ts
import { test, expect } from "bun:test";
import { applyAction } from "../reducer";
import { createGame } from "../state";
import { WORLD } from "../../data/world";
import { CONFIG } from "../../data/config";

// Start a playing game with the player employed as janitor (works at "factory", node n0).
function employedAtFactory() {
  let g = createGame({ playerName: "Al", startNode: "n0", seed: 1 });
  g = applyAction(g, { type: "setGoals", goals: g.goals }, WORLD).state;
  g = { ...g, players: [{ ...g.players[0], jobId: "janitor", position: "n0" }] };
  return g;
}

test("work pays wage, costs time, adds experience", () => {
  const g = employedAtFactory();
  const before = g.players[0];
  const r = applyAction(g, { type: "work" }, WORLD);
  expect(r.ok).toBe(true);
  const p = r.state.players[0];
  expect(p.cash).toBe(before.cash + WORLD.jobs.janitor.wage); // careerLevel 0 → base wage
  expect(p.timeLeft).toBe(before.timeLeft - WORLD.jobs.janitor.timeCost);
  expect(p.experience).toBe(before.experience + 1);
});

test("work is rejected with no job", () => {
  let g = createGame({ playerName: "Al", startNode: "n0", seed: 1 });
  g = applyAction(g, { type: "setGoals", goals: g.goals }, WORLD).state;
  const r = applyAction(g, { type: "work" }, WORLD);
  expect(r.ok).toBe(false);
  expect(r.reason).toMatch(/job/i);
});

test("work is rejected when not at the job's building", () => {
  let g = employedAtFactory();
  g = { ...g, players: [{ ...g.players[0], position: "n3" }] }; // university, not factory
  const r = applyAction(g, { type: "work" }, WORLD);
  expect(r.ok).toBe(false);
  expect(r.reason).toMatch(/workplace|building|there/i);
});

test("work is rejected without enough time", () => {
  let g = employedAtFactory();
  g = { ...g, players: [{ ...g.players[0], timeLeft: 1 }] };
  const r = applyAction(g, { type: "work" }, WORLD);
  expect(r.ok).toBe(false);
  expect(r.reason).toMatch(/time/i);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun test game/engine/actions/work.test.ts`
Expected: FAIL — `work.ts` not found / `work` not a valid action type.

- [ ] **Step 3: Implement `game/engine/actions/work.ts`**

```ts
// game/engine/actions/work.ts
import type { GameState } from "../state";
import type { World } from "../world";
import { type ApplyResult, ok, reject, updateCurrent } from "../result";
import { buildingAt } from "../../data/buildings";
import { wageFor } from "../wages";

export interface WorkAction {
  type: "work";
}

export function work(state: GameState, _action: WorkAction, world: World): ApplyResult {
  if (state.phase !== "playing") return reject(state, "Can only work while playing.");
  const player = state.players[state.current];
  if (!player.jobId) return reject(state, "You have no job.");
  const job = world.jobs[player.jobId];
  if (!job) return reject(state, `Unknown job: ${player.jobId}`);
  const here = buildingAt(world.buildings, player.position);
  if (!here || here.id !== job.buildingId) {
    return reject(state, "You must be at your workplace to work.");
  }
  if (job.timeCost > player.timeLeft) return reject(state, "Not enough time to work a shift.");
  const pay = wageFor(job, player.careerLevel);
  return ok(
    updateCurrent(state, (p) => ({
      ...p,
      cash: p.cash + pay,
      timeLeft: p.timeLeft - job.timeCost,
      experience: p.experience + 1,
    })),
  );
}
```

- [ ] **Step 4: Register the action in `game/engine/reducer.ts`**

Add the import (with the other action imports):
```ts
import { work, type WorkAction } from "./actions/work";
```
Extend the `Action` union:
```ts
export type Action = SetGoalsAction | MoveToAction | WorkAction;
```
Add the case (before `default:`):
```ts
    case "work":
      return work(state, action, world);
```

- [ ] **Step 5: Run to verify it passes**

Run: `bun test game/engine/actions/work.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add game/engine/actions/work.ts game/engine/actions/work.test.ts game/engine/reducer.ts
git commit -m "feat(engine): add work action"
```

---

## Task 8: Action — applyForJob

Requires: phase playing, standing at a building whose `hiring` service lists the job, enough education, and enough time (`CONFIG.applyJobTimeCost`). Sets `jobId`.

**Files:**
- Create: `game/engine/actions/applyForJob.ts`
- Modify: `game/engine/reducer.ts`
- Test: `game/engine/actions/applyForJob.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// game/engine/actions/applyForJob.test.ts
import { test, expect } from "bun:test";
import { applyAction } from "../reducer";
import { createGame } from "../state";
import { WORLD } from "../../data/world";
import { CONFIG } from "../../data/config";

// Playing game with the player at the employment office (node n2).
function atEmployment() {
  let g = createGame({ playerName: "Al", startNode: "n2", seed: 1 });
  g = applyAction(g, { type: "setGoals", goals: g.goals }, WORLD).state;
  return g;
}

test("applying for a job you qualify for sets jobId and costs time", () => {
  const g = atEmployment();
  const r = applyAction(g, { type: "applyForJob", job: "janitor" }, WORLD); // requires education 0
  expect(r.ok).toBe(true);
  expect(r.state.players[0].jobId).toBe("janitor");
  expect(r.state.players[0].timeLeft).toBe(CONFIG.weeklyTimeBudget - CONFIG.applyJobTimeCost);
});

test("applying is rejected without enough education", () => {
  const g = atEmployment(); // education 0
  const r = applyAction(g, { type: "applyForJob", job: "engineer" }, WORLD); // requires 60
  expect(r.ok).toBe(false);
  expect(r.reason).toMatch(/education/i);
});

test("applying is rejected away from a hiring building", () => {
  let g = atEmployment();
  g = { ...g, players: [{ ...g.players[0], position: "n4" }] }; // bank, no hiring
  const r = applyAction(g, { type: "applyForJob", job: "janitor" }, WORLD);
  expect(r.ok).toBe(false);
  expect(r.reason).toMatch(/hiring|employment|here/i);
});

test("applying for a job not offered here is rejected", () => {
  const g = atEmployment();
  const r = applyAction(g, { type: "applyForJob", job: "ghostjob" }, WORLD);
  expect(r.ok).toBe(false);
  expect(r.reason).toMatch(/offered|job/i);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun test game/engine/actions/applyForJob.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `game/engine/actions/applyForJob.ts`**

```ts
// game/engine/actions/applyForJob.ts
import type { GameState, JobId } from "../state";
import type { World } from "../world";
import { type ApplyResult, ok, reject, updateCurrent } from "../result";
import { buildingAt } from "../../data/buildings";
import { CONFIG } from "../../data/config";

export interface ApplyForJobAction {
  type: "applyForJob";
  job: JobId;
}

export function applyForJob(state: GameState, action: ApplyForJobAction, world: World): ApplyResult {
  if (state.phase !== "playing") return reject(state, "Can only apply while playing.");
  const player = state.players[state.current];
  const here = buildingAt(world.buildings, player.position);
  const hiring = here?.services.find((s) => s.kind === "hiring");
  if (!hiring || hiring.kind !== "hiring") {
    return reject(state, "No hiring office here.");
  }
  if (!hiring.jobIds.includes(action.job)) {
    return reject(state, "That job is not offered here.");
  }
  const job = world.jobs[action.job];
  if (!job) return reject(state, `Unknown job: ${action.job}`);
  if (player.education < job.requiredEducation) {
    return reject(state, "You need more education for that job.");
  }
  if (CONFIG.applyJobTimeCost > player.timeLeft) {
    return reject(state, "Not enough time to apply.");
  }
  return ok(
    updateCurrent(state, (p) => ({
      ...p,
      jobId: action.job,
      timeLeft: p.timeLeft - CONFIG.applyJobTimeCost,
    })),
  );
}
```

- [ ] **Step 4: Register in `game/engine/reducer.ts`**

Import:
```ts
import { applyForJob, type ApplyForJobAction } from "./actions/applyForJob";
```
Union:
```ts
export type Action = SetGoalsAction | MoveToAction | WorkAction | ApplyForJobAction;
```
Case (before `default:`):
```ts
    case "applyForJob":
      return applyForJob(state, action, world);
```

- [ ] **Step 5: Run to verify it passes**

Run: `bun test game/engine/actions/applyForJob.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add game/engine/actions/applyForJob.ts game/engine/actions/applyForJob.test.ts game/engine/reducer.ts
git commit -m "feat(engine): add applyForJob action"
```

---

## Task 9: Action — takeClass

Requires: phase playing, at a building whose `education` service lists the course, enough cash and time. Pays cash + time, raises education.

**Files:**
- Create: `game/engine/actions/takeClass.ts`
- Modify: `game/engine/reducer.ts`
- Test: `game/engine/actions/takeClass.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// game/engine/actions/takeClass.test.ts
import { test, expect } from "bun:test";
import { applyAction } from "../reducer";
import { createGame } from "../state";
import { WORLD } from "../../data/world";

function atUniversity(cash = 1000) {
  let g = createGame({ playerName: "Al", startNode: "n3", seed: 1 }); // university = n3
  g = applyAction(g, { type: "setGoals", goals: g.goals }, WORLD).state;
  g = { ...g, players: [{ ...g.players[0], cash }] };
  return g;
}

test("taking a class raises education, costs cash and time", () => {
  const g = atUniversity();
  const before = g.players[0];
  const c = WORLD.courses.basics;
  const r = applyAction(g, { type: "takeClass", course: "basics" }, WORLD);
  expect(r.ok).toBe(true);
  const p = r.state.players[0];
  expect(p.education).toBe(before.education + c.educationGain);
  expect(p.cash).toBe(before.cash - c.cost);
  expect(p.timeLeft).toBe(before.timeLeft - c.timeCost);
});

test("taking a class is rejected without enough cash", () => {
  const g = atUniversity(10); // engineering costs 250
  const r = applyAction(g, { type: "takeClass", course: "engineering" }, WORLD);
  expect(r.ok).toBe(false);
  expect(r.reason).toMatch(/cash|afford|money/i);
});

test("taking a class is rejected away from a university", () => {
  let g = atUniversity();
  g = { ...g, players: [{ ...g.players[0], position: "n4" }] }; // bank
  const r = applyAction(g, { type: "takeClass", course: "basics" }, WORLD);
  expect(r.ok).toBe(false);
  expect(r.reason).toMatch(/education|university|here/i);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun test game/engine/actions/takeClass.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `game/engine/actions/takeClass.ts`**

```ts
// game/engine/actions/takeClass.ts
import type { GameState } from "../state";
import type { CourseId } from "../../data/courses";
import type { World } from "../world";
import { type ApplyResult, ok, reject, updateCurrent } from "../result";
import { buildingAt } from "../../data/buildings";

export interface TakeClassAction {
  type: "takeClass";
  course: CourseId;
}

export function takeClass(state: GameState, action: TakeClassAction, world: World): ApplyResult {
  if (state.phase !== "playing") return reject(state, "Can only study while playing.");
  const player = state.players[state.current];
  const here = buildingAt(world.buildings, player.position);
  const edu = here?.services.find((s) => s.kind === "education");
  if (!edu || edu.kind !== "education") return reject(state, "No classes offered here.");
  if (!edu.courseIds.includes(action.course)) return reject(state, "That course is not offered here.");
  const course = world.courses[action.course];
  if (!course) return reject(state, `Unknown course: ${action.course}`);
  if (course.cost > player.cash) return reject(state, "You can't afford that course.");
  if (course.timeCost > player.timeLeft) return reject(state, "Not enough time for that class.");
  return ok(
    updateCurrent(state, (p) => ({
      ...p,
      cash: p.cash - course.cost,
      education: p.education + course.educationGain,
      timeLeft: p.timeLeft - course.timeCost,
    })),
  );
}
```

- [ ] **Step 4: Register in `game/engine/reducer.ts`**

Import:
```ts
import { takeClass, type TakeClassAction } from "./actions/takeClass";
```
Union: add `| TakeClassAction`.
Case (before `default:`):
```ts
    case "takeClass":
      return takeClass(state, action, world);
```

- [ ] **Step 5: Run to verify it passes**

Run: `bun test game/engine/actions/takeClass.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add game/engine/actions/takeClass.ts game/engine/actions/takeClass.test.ts game/engine/reducer.ts
git commit -m "feat(engine): add takeClass action"
```

---

## Task 10: Action — buy

Requires: phase playing, at a building whose `shop` service lists the item, enough cash and time. Pays cash + time, adds item to inventory, raises happiness by the item's `happinessGain`.

**Files:**
- Create: `game/engine/actions/buy.ts`
- Modify: `game/engine/reducer.ts`
- Test: `game/engine/actions/buy.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// game/engine/actions/buy.test.ts
import { test, expect } from "bun:test";
import { applyAction } from "../reducer";
import { createGame } from "../state";
import { WORLD } from "../../data/world";

function atShop(cash = 1000) {
  let g = createGame({ playerName: "Al", startNode: "n1", seed: 1 }); // tryandsave = n1, has shop
  g = applyAction(g, { type: "setGoals", goals: g.goals }, WORLD).state;
  g = { ...g, players: [{ ...g.players[0], cash }] };
  return g;
}

test("buying adds the item, raises happiness, costs cash and time", () => {
  const g = atShop();
  const before = g.players[0];
  const item = WORLD.items.burger;
  const r = applyAction(g, { type: "buy", item: "burger" }, WORLD);
  expect(r.ok).toBe(true);
  const p = r.state.players[0];
  expect(p.inventory).toContain("burger");
  expect(p.happiness).toBe(before.happiness + item.happinessGain);
  expect(p.cash).toBe(before.cash - item.cost);
  expect(p.timeLeft).toBe(before.timeLeft - item.timeCost);
});

test("buying is rejected without enough cash", () => {
  const g = atShop(5); // tv costs 300
  const r = applyAction(g, { type: "buy", item: "tv" }, WORLD);
  expect(r.ok).toBe(false);
  expect(r.reason).toMatch(/cash|afford|money/i);
});

test("buying is rejected away from a shop", () => {
  let g = atShop();
  g = { ...g, players: [{ ...g.players[0], position: "n4" }] }; // bank
  const r = applyAction(g, { type: "buy", item: "burger" }, WORLD);
  expect(r.ok).toBe(false);
  expect(r.reason).toMatch(/shop|sell|here/i);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun test game/engine/actions/buy.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `game/engine/actions/buy.ts`**

```ts
// game/engine/actions/buy.ts
import type { GameState, ItemId } from "../state";
import type { World } from "../world";
import { type ApplyResult, ok, reject, updateCurrent } from "../result";
import { buildingAt } from "../../data/buildings";

export interface BuyAction {
  type: "buy";
  item: ItemId;
}

export function buy(state: GameState, action: BuyAction, world: World): ApplyResult {
  if (state.phase !== "playing") return reject(state, "Can only shop while playing.");
  const player = state.players[state.current];
  const here = buildingAt(world.buildings, player.position);
  const shop = here?.services.find((s) => s.kind === "shop");
  if (!shop || shop.kind !== "shop") return reject(state, "No shop here.");
  if (!shop.itemIds.includes(action.item)) return reject(state, "That item is not sold here.");
  const item = world.items[action.item];
  if (!item) return reject(state, `Unknown item: ${action.item}`);
  if (item.cost > player.cash) return reject(state, "You can't afford that.");
  if (item.timeCost > player.timeLeft) return reject(state, "Not enough time to shop.");
  return ok(
    updateCurrent(state, (p) => ({
      ...p,
      cash: p.cash - item.cost,
      happiness: p.happiness + item.happinessGain,
      timeLeft: p.timeLeft - item.timeCost,
      inventory: [...p.inventory, action.item],
    })),
  );
}
```

- [ ] **Step 4: Register in `game/engine/reducer.ts`**

Import:
```ts
import { buy, type BuyAction } from "./actions/buy";
```
Union: add `| BuyAction`.
Case (before `default:`):
```ts
    case "buy":
      return buy(state, action, world);
```

- [ ] **Step 5: Run to verify it passes**

Run: `bun test game/engine/actions/buy.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add game/engine/actions/buy.ts game/engine/actions/buy.test.ts game/engine/reducer.ts
git commit -m "feat(engine): add buy action"
```

---

## Task 11: Action — bank

Requires: phase playing, at a building with a `bank` service, a positive `amount`. Ops: `deposit` (cash→bank), `withdraw` (bank→cash), `loan` (cash+=amount, debt+=amount), `repay` (pay down debt from cash, capped at the smaller of debt and cash). Banking costs no time.

**Files:**
- Create: `game/engine/actions/bank.ts`
- Modify: `game/engine/reducer.ts`
- Test: `game/engine/actions/bank.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// game/engine/actions/bank.test.ts
import { test, expect } from "bun:test";
import { applyAction } from "../reducer";
import { createGame } from "../state";
import { WORLD } from "../../data/world";

function atBank(over: Partial<ReturnType<typeof createGame>["players"][number]> = {}) {
  let g = createGame({ playerName: "Al", startNode: "n4", seed: 1 }); // bank = n4
  g = applyAction(g, { type: "setGoals", goals: g.goals }, WORLD).state;
  g = { ...g, players: [{ ...g.players[0], ...over }] };
  return g;
}

test("deposit moves cash into the bank", () => {
  const g = atBank({ cash: 500, bank: 0 });
  const r = applyAction(g, { type: "bank", op: "deposit", amount: 200 }, WORLD);
  expect(r.ok).toBe(true);
  expect(r.state.players[0].cash).toBe(300);
  expect(r.state.players[0].bank).toBe(200);
});

test("withdraw moves bank into cash", () => {
  const g = atBank({ cash: 0, bank: 200 });
  const r = applyAction(g, { type: "bank", op: "withdraw", amount: 150 }, WORLD);
  expect(r.ok).toBe(true);
  expect(r.state.players[0].cash).toBe(150);
  expect(r.state.players[0].bank).toBe(50);
});

test("loan increases both cash and debt", () => {
  const g = atBank({ cash: 100, debt: 0 });
  const r = applyAction(g, { type: "bank", op: "loan", amount: 500 }, WORLD);
  expect(r.ok).toBe(true);
  expect(r.state.players[0].cash).toBe(600);
  expect(r.state.players[0].debt).toBe(500);
});

test("repay reduces debt and cash by the same amount", () => {
  const g = atBank({ cash: 300, debt: 500 });
  const r = applyAction(g, { type: "bank", op: "repay", amount: 200 }, WORLD);
  expect(r.ok).toBe(true);
  expect(r.state.players[0].cash).toBe(100);
  expect(r.state.players[0].debt).toBe(300);
});

test("deposit is rejected without enough cash", () => {
  const g = atBank({ cash: 50 });
  const r = applyAction(g, { type: "bank", op: "deposit", amount: 200 }, WORLD);
  expect(r.ok).toBe(false);
  expect(r.reason).toMatch(/cash|funds/i);
});

test("repay cannot exceed debt or cash", () => {
  const g = atBank({ cash: 100, debt: 40 });
  const r = applyAction(g, { type: "bank", op: "repay", amount: 999 }, WORLD);
  expect(r.ok).toBe(false);
  expect(r.reason).toMatch(/debt|cash|too much/i);
});

test("non-positive amounts are rejected", () => {
  const g = atBank({ cash: 100 });
  const r = applyAction(g, { type: "bank", op: "deposit", amount: 0 }, WORLD);
  expect(r.ok).toBe(false);
  expect(r.reason).toMatch(/amount|positive/i);
});

test("banking is rejected away from a bank", () => {
  let g = atBank({ cash: 100 });
  g = { ...g, players: [{ ...g.players[0], position: "n3" }] }; // university
  const r = applyAction(g, { type: "bank", op: "deposit", amount: 50 }, WORLD);
  expect(r.ok).toBe(false);
  expect(r.reason).toMatch(/bank|here/i);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun test game/engine/actions/bank.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `game/engine/actions/bank.ts`**

```ts
// game/engine/actions/bank.ts
import type { GameState, Player } from "../state";
import type { World } from "../world";
import { type ApplyResult, ok, reject, updateCurrent } from "../result";
import { buildingAt, hasService } from "../../data/buildings";

export type BankOp = "deposit" | "withdraw" | "loan" | "repay";

export interface BankAction {
  type: "bank";
  op: BankOp;
  amount: number;
}

export function bank(state: GameState, action: BankAction, world: World): ApplyResult {
  if (state.phase !== "playing") return reject(state, "Can only bank while playing.");
  const player = state.players[state.current];
  const here = buildingAt(world.buildings, player.position);
  if (!here || !hasService(here, "bank")) return reject(state, "No bank here.");
  if (!(action.amount > 0)) return reject(state, "Amount must be positive.");

  const apply = (fn: (p: Player) => Player) => ok(updateCurrent(state, fn));

  switch (action.op) {
    case "deposit":
      if (action.amount > player.cash) return reject(state, "Not enough cash to deposit.");
      return apply((p) => ({ ...p, cash: p.cash - action.amount, bank: p.bank + action.amount }));
    case "withdraw":
      if (action.amount > player.bank) return reject(state, "Not enough funds in the bank.");
      return apply((p) => ({ ...p, bank: p.bank - action.amount, cash: p.cash + action.amount }));
    case "loan":
      return apply((p) => ({ ...p, cash: p.cash + action.amount, debt: p.debt + action.amount }));
    case "repay":
      if (action.amount > player.debt) return reject(state, "You don't owe that much debt.");
      if (action.amount > player.cash) return reject(state, "Not enough cash to repay that much.");
      return apply((p) => ({ ...p, cash: p.cash - action.amount, debt: p.debt - action.amount }));
    default: {
      const _exhaustive: never = action.op;
      return reject(state, `Unknown bank op: ${_exhaustive as string}`);
    }
  }
}
```

- [ ] **Step 4: Register in `game/engine/reducer.ts`**

Import:
```ts
import { bank, type BankAction } from "./actions/bank";
```
Union: add `| BankAction`.
Case (before `default:`):
```ts
    case "bank":
      return bank(state, action, world);
```

- [ ] **Step 5: Run to verify it passes**

Run: `bun test game/engine/actions/bank.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 6: Commit**

```bash
git add game/engine/actions/bank.ts game/engine/actions/bank.test.ts game/engine/reducer.ts
git commit -m "feat(engine): add bank action"
```

---

## Task 12: Action — rent

Requires: phase playing, at a building whose `housing` service lists the place. Sets `weeklyRent` and `housingId` (rent is charged at week-end, not now). Costs no time.

**Files:**
- Create: `game/engine/actions/rent.ts`
- Modify: `game/engine/reducer.ts`
- Test: `game/engine/actions/rent.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// game/engine/actions/rent.test.ts
import { test, expect } from "bun:test";
import { applyAction } from "../reducer";
import { createGame } from "../state";
import { WORLD } from "../../data/world";

function atRentOffice() {
  let g = createGame({ playerName: "Al", startNode: "n5", seed: 1 }); // rentoffice = n5
  g = applyAction(g, { type: "setGoals", goals: g.goals }, WORLD).state;
  return g;
}

test("renting sets weeklyRent and housingId", () => {
  const g = atRentOffice();
  const r = applyAction(g, { type: "rent", unit: "lowcost" }, WORLD);
  expect(r.ok).toBe(true);
  expect(r.state.players[0].housingId).toBe("lowcost");
  expect(r.state.players[0].weeklyRent).toBe(WORLD.housing.lowcost.weeklyRent);
});

test("renting an unlisted unit is rejected", () => {
  const g = atRentOffice();
  const r = applyAction(g, { type: "rent", unit: "mansion" }, WORLD);
  expect(r.ok).toBe(false);
  expect(r.reason).toMatch(/available|housing|unit/i);
});

test("renting away from a rent office is rejected", () => {
  let g = atRentOffice();
  g = { ...g, players: [{ ...g.players[0], position: "n4" }] }; // bank
  const r = applyAction(g, { type: "rent", unit: "lowcost" }, WORLD);
  expect(r.ok).toBe(false);
  expect(r.reason).toMatch(/housing|rent|here/i);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun test game/engine/actions/rent.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `game/engine/actions/rent.ts`**

```ts
// game/engine/actions/rent.ts
import type { GameState, HousingId } from "../state";
import type { World } from "../world";
import { type ApplyResult, ok, reject, updateCurrent } from "../result";
import { buildingAt } from "../../data/buildings";

export interface RentAction {
  type: "rent";
  unit: HousingId;
}

export function rent(state: GameState, action: RentAction, world: World): ApplyResult {
  if (state.phase !== "playing") return reject(state, "Can only rent while playing.");
  const player = state.players[state.current];
  const here = buildingAt(world.buildings, player.position);
  const housing = here?.services.find((s) => s.kind === "housing");
  if (!housing || housing.kind !== "housing") return reject(state, "No rentals here.");
  if (!housing.housingIds.includes(action.unit)) return reject(state, "That unit is not available here.");
  const unit = world.housing[action.unit];
  if (!unit) return reject(state, `Unknown housing: ${action.unit}`);
  return ok(updateCurrent(state, (p) => ({ ...p, housingId: action.unit, weeklyRent: unit.weeklyRent })));
}
```

- [ ] **Step 4: Register in `game/engine/reducer.ts`**

Import:
```ts
import { rent, type RentAction } from "./actions/rent";
```
Union: add `| RentAction`.
Case (before `default:`):
```ts
    case "rent":
      return rent(state, action, world);
```

- [ ] **Step 5: Run to verify it passes**

Run: `bun test game/engine/actions/rent.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add game/engine/actions/rent.ts game/engine/actions/rent.test.ts game/engine/reducer.ts
git commit -m "feat(engine): add rent action"
```

---

## Task 13: Economy settlement helpers

Pure functions used by `endWeek`. Each takes a `Player` and returns a new `Player` (immutable). A `LogEntry[]` builder reports what happened.

**Files:**
- Create: `game/engine/economy.ts`
- Test: `game/engine/economy.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// game/engine/economy.test.ts
import { test, expect } from "bun:test";
import { accrueInterest, settleRent, checkPromotion, decayHappiness } from "./economy";
import { createGame } from "./state";
import { CONFIG } from "../data/config";

function player(over: Partial<ReturnType<typeof createGame>["players"][number]>) {
  return { ...createGame({ playerName: "Al", startNode: "n0", seed: 1 }).players[0], ...over };
}

test("accrueInterest adds bank interest and loan interest, rounded", () => {
  const p = accrueInterest(player({ bank: 1000, debt: 200 }));
  expect(p.bank).toBe(1000 + Math.round(1000 * CONFIG.bankInterestRate)); // +20
  expect(p.debt).toBe(200 + Math.round(200 * CONFIG.loanInterestRate));   // +10
});

test("settleRent pays from cash", () => {
  const p = settleRent(player({ cash: 100, weeklyRent: 40, debt: 0 }));
  expect(p.cash).toBe(60);
  expect(p.debt).toBe(0);
});

test("settleRent rolls the unpayable remainder into debt (gentle failure)", () => {
  const p = settleRent(player({ cash: 30, weeklyRent: 100, debt: 0 }));
  expect(p.cash).toBe(0);
  expect(p.debt).toBe(70); // 100 owed - 30 paid
});

test("checkPromotion raises careerLevel when experience and education suffice", () => {
  const p = checkPromotion(player({
    jobId: "janitor",
    careerLevel: 0,
    experience: CONFIG.promotionExperience,
    education: CONFIG.educationPerCareerLevel, // needs 20 for level 1
  }));
  expect(p.careerLevel).toBe(1);
  expect(p.experience).toBe(0); // consumed
});

test("checkPromotion does nothing without enough education", () => {
  const p = checkPromotion(player({
    jobId: "janitor", careerLevel: 0, experience: CONFIG.promotionExperience, education: 0,
  }));
  expect(p.careerLevel).toBe(0);
  expect(p.experience).toBe(CONFIG.promotionExperience);
});

test("checkPromotion does nothing without a job", () => {
  const p = checkPromotion(player({ jobId: null, experience: 99, education: 999 }));
  expect(p.careerLevel).toBe(0);
});

test("decayHappiness drops happiness but not below zero", () => {
  expect(decayHappiness(player({ happiness: 3 })).happiness).toBe(0);
  expect(decayHappiness(player({ happiness: 50 })).happiness).toBe(50 - CONFIG.happinessDecayPerWeek);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun test game/engine/economy.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `game/engine/economy.ts`**

```ts
// game/engine/economy.ts
import type { Player } from "./state";
import { CONFIG } from "../data/config";

// Weekly bank + loan interest.
export function accrueInterest(p: Player): Player {
  return {
    ...p,
    bank: p.bank + Math.round(p.bank * CONFIG.bankInterestRate),
    debt: p.debt + Math.round(p.debt * CONFIG.loanInterestRate),
  };
}

// Pay weekly rent from cash; any shortfall becomes debt (gentle failure).
export function settleRent(p: Player): Player {
  const owed = p.weeklyRent;
  const paid = Math.min(owed, p.cash);
  return { ...p, cash: p.cash - paid, debt: p.debt + (owed - paid) };
}

// Promote one level if employed, experienced enough, and educated enough for the next level.
export function checkPromotion(p: Player): Player {
  if (!p.jobId) return p;
  const needEducation = CONFIG.educationPerCareerLevel * (p.careerLevel + 1);
  if (p.experience >= CONFIG.promotionExperience && p.education >= needEducation) {
    return { ...p, careerLevel: p.careerLevel + 1, experience: p.experience - CONFIG.promotionExperience };
  }
  return p;
}

// Happiness drifts down each week, floored at zero.
export function decayHappiness(p: Player): Player {
  return { ...p, happiness: Math.max(0, p.happiness - CONFIG.happinessDecayPerWeek) };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `bun test game/engine/economy.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add game/engine/economy.ts game/engine/economy.test.ts
git commit -m "feat(engine): add economy settlement helpers"
```

---

## Task 14: Action — endWeek

Runs settlement in the spec's fixed order: interest → rent → promotion → happiness decay → reset time + advance week → win check. Appends a log entry. Valid only while playing. After settlement the phase stays `playing` unless the player has won, in which case it becomes `won`.

**Files:**
- Create: `game/engine/actions/endWeek.ts`
- Modify: `game/engine/reducer.ts`
- Test: `game/engine/actions/endWeek.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// game/engine/actions/endWeek.test.ts
import { test, expect } from "bun:test";
import { applyAction } from "../reducer";
import { createGame } from "../state";
import { WORLD } from "../../data/world";
import { CONFIG } from "../../data/config";

function playing(over: Partial<ReturnType<typeof createGame>["players"][number]> = {}) {
  let g = createGame({ playerName: "Al", startNode: "n0", seed: 1 });
  g = applyAction(g, { type: "setGoals", goals: g.goals }, WORLD).state;
  g = { ...g, players: [{ ...g.players[0], ...over }] };
  return g;
}

test("endWeek advances the week and refills time", () => {
  const g = playing({ timeLeft: 3 });
  const r = applyAction(g, { type: "endWeek" }, WORLD);
  expect(r.ok).toBe(true);
  expect(r.state.week).toBe(2);
  expect(r.state.players[0].timeLeft).toBe(CONFIG.weeklyTimeBudget);
  expect(r.state.phase).toBe("playing");
});

test("endWeek accrues interest, charges rent, and decays happiness", () => {
  const g = playing({ cash: 500, bank: 1000, debt: 0, weeklyRent: 40, happiness: 50 });
  const r = applyAction(g, { type: "endWeek" }, WORLD);
  const p = r.state.players[0];
  expect(p.bank).toBe(1020);          // +2% of 1000
  expect(p.cash).toBe(460);           // 500 - 40 rent
  expect(p.happiness).toBe(45);       // -5 decay
});

test("endWeek logs an entry for the week", () => {
  const g = playing();
  const r = applyAction(g, { type: "endWeek" }, WORLD);
  expect(r.state.log.length).toBe(1);
  expect(r.state.log[0].week).toBe(1);
});

test("endWeek sets phase to won when all goals are met", () => {
  const g = playing({
    cash: 99999, happiness: 999, education: 999, careerLevel: 99,
  });
  const r = applyAction(g, { type: "endWeek" }, WORLD);
  expect(r.state.phase).toBe("won");
});

test("endWeek is rejected when not playing", () => {
  const g = createGame({ playerName: "Al", startNode: "n0", seed: 1 }); // setup phase
  const r = applyAction(g, { type: "endWeek" }, WORLD);
  expect(r.ok).toBe(false);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun test game/engine/actions/endWeek.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `game/engine/actions/endWeek.ts`**

```ts
// game/engine/actions/endWeek.ts
import type { GameState, Player, LogEntry } from "../state";
import type { World } from "../world";
import { type ApplyResult, ok, reject } from "../result";
import { CONFIG } from "../../data/config";
import { accrueInterest, settleRent, checkPromotion, decayHappiness } from "../economy";
import { hasWon } from "../winCheck";

export interface EndWeekAction {
  type: "endWeek";
}

export function endWeek(state: GameState, _action: EndWeekAction, _world: World): ApplyResult {
  if (state.phase !== "playing") return reject(state, "Can only end the week while playing.");

  // Settlement order: interest → rent → promotion → happiness decay → reset time.
  const settle = (p: Player): Player => {
    let next = accrueInterest(p);
    next = settleRent(next);
    next = checkPromotion(next);
    next = decayHappiness(next);
    return { ...next, timeLeft: CONFIG.weeklyTimeBudget };
  };

  const players = state.players.map((p, i) => (i === state.current ? settle(p) : p));
  const log: LogEntry[] = [
    ...state.log,
    { week: state.week, text: `Week ${state.week} settled.` },
  ];
  let next: GameState = { ...state, players, week: state.week + 1, log };

  if (hasWon(next, state.current)) {
    next = { ...next, phase: "won" };
  }
  return ok(next);
}
```

- [ ] **Step 4: Register in `game/engine/reducer.ts`**

Import:
```ts
import { endWeek, type EndWeekAction } from "./actions/endWeek";
```
Union: add `| EndWeekAction`.
Case (before `default:`):
```ts
    case "endWeek":
      return endWeek(state, action, world);
```

- [ ] **Step 5: Run to verify it passes**

Run: `bun test game/engine/actions/endWeek.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Run the whole suite + typecheck**

Run: `bun test && bunx tsc --noEmit -p tsconfig.json`
Expected: all suites green; tsc exits 0.

- [ ] **Step 7: Commit**

```bash
git add game/engine/actions/endWeek.ts game/engine/actions/endWeek.test.ts game/engine/reducer.ts
git commit -m "feat(engine): add endWeek settlement action"
```

---

## Task 15: Integration playthrough test

A single test that drives the full loop through `applyAction` to prove the pieces compose: move → apply for a job → work → study → buy happiness → bank → end week, ending in a win when goals are modest.

**Files:**
- Create: `game/engine/playthrough.test.ts`

- [ ] **Step 1: Write the test**

```ts
// game/engine/playthrough.test.ts
import { test, expect } from "bun:test";
import { applyAction, type Action } from "./reducer";
import { createGame } from "./state";
import { WORLD } from "../data/world";

// Apply a sequence, asserting each step succeeds; returns the final state.
function run(start: ReturnType<typeof createGame>, actions: Action[]) {
  let g = start;
  for (const a of actions) {
    const r = applyAction(g, a, WORLD);
    if (!r.ok) throw new Error(`action ${a.type} rejected: ${r.reason}`);
    g = r.state;
  }
  return g;
}

// Route is traced to fit the 60-unit weekly budget:
//   class 15 + move(n3→n2) 5 + apply 5 + move(n2→n1) 5 + work 15 + buy 5 = 50.
test("a productive week reaches a win against easy goals", () => {
  let g = createGame({ playerName: "Al", startNode: "n3", seed: 7 }); // start at university (n3)
  // Easy goals: happiness target 0 because happiness decays at week-end.
  g = applyAction(g, {
    type: "setGoals",
    goals: { wealth: 100, happiness: 0, education: 20, career: 0 },
  }, WORLD).state;

  // Play the week (everything before settling).
  g = run(g, [
    { type: "takeClass", course: "basics" },   // n3: +20 education, -50 cash
    { type: "moveTo", node: "n2" },            // to employment office (1 hop)
    { type: "applyForJob", job: "clerk" },     // needs education 20 ✓
    { type: "moveTo", node: "n1" },            // to Try and Save (clerk's workplace + a shop)
    { type: "work" },                          // +120 cash (career 0)
    { type: "buy", item: "burger" },           // +6 happiness, sold here
  ]);

  // Mid-week assertions (before week-end decay).
  const mid = g.players[0];
  expect(mid.jobId).toBe("clerk");
  expect(mid.education).toBeGreaterThanOrEqual(20);
  expect(mid.happiness).toBe(WORLD.items.burger.happinessGain); // 6
  expect(mid.cash).toBe(262); // 200 start − 50 class + 120 work − 8 burger

  // Settle the week → all four goals met → win.
  const r = applyAction(g, { type: "endWeek" }, WORLD);
  expect(r.ok).toBe(true);
  expect(r.state.phase).toBe("won"); // wealth 262, education 20, happiness≥0, career 0
});
```

- [ ] **Step 2: Run to verify it passes**

Run: `bun test game/engine/playthrough.test.ts`
Expected: PASS (1 test).

- [ ] **Step 3: Final full suite + typecheck**

Run: `bun test && bunx tsc --noEmit -p tsconfig.json`
Expected: all green; tsc exits 0.

- [ ] **Step 4: Commit**

```bash
git add game/engine/playthrough.test.ts
git commit -m "test(engine): add full-loop playthrough integration test"
```

---

## Done criteria for Plan 2

- `applyAction` handles all nine actions: `setGoals`, `moveTo`, `work`, `applyForJob`, `takeClass`, `buy`, `bank`, `rent`, `endWeek` — each validated, immutable, in its own file.
- Data-driven buildings/jobs/courses/items/housing tables, assembled into a `World` passed to the reducer.
- Week settlement (interest → rent→debt → promotion → happiness decay → time reset → win check) works and logs.
- `bun test` green across all suites; strict `tsc` clean.
- The integration test proves a player can play a week through the public action API and win.

**Carried forward / not in this plan:**
- Real board-node wiring for all 13 buildings (waits on SVG waypoints; buildings currently sit on `testRing`).
- Vehicle service + weekend passive-income hook (the Tesla idea) — future, once the base loop is proven.
- Plan 3: Svelte 5 UI (board rendering, hit-box clicks, center-panel screens, persistence).
