# Jones Game — Plan 3: Real Board Wiring

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hand-built 8-node `testRing` (for the real game) with the actual 13-node board ring derived from the waypoints in `assets/board.svg`, wire all 13 real buildings to their doorstep nodes with services, and keep the engine fully green — while preserving a small `TEST_WORLD` fixture for the unit tests.

**Architecture:** Pure/headless, builds on Plan 2. Node ids equal building ids (every board space is exactly one building, 13:13), so `buildingAt(node)` is trivial and `moveTo(building.node)` is how the UI will move the player. Node screen-coordinates (extracted from the SVG waypoints) are stored as data for the future UI; the SVG remains only the visual backdrop — no runtime SVG parser. The load-time building/graph validation moves from `buildings.ts` into `makeWorld(graph, buildings)` (a follow-up flagged in the Plan 2 review).

**Tech Stack:** Bun (`bun test`), TypeScript (strict, `verbatimModuleSyntax`, `noUnusedLocals` — scoped to `game/`).

**Prerequisite:** Plan 2 merged to `main`. Work on a new branch `game-board`.

---

## Waypoint data (already extracted from assets/board.svg)

13 waypoints form the road ring. Clockwise order, with the building each fronts and its screen coordinate (board is 2300×1850):

| ring # | node id (= building id) | (x, y) | building name | SVG group id |
|---|---|---|---|---|
| 0 | `highsec` | (242, 474) | High Security | `High-Security` |
| 1 | `rentoffice` | (702, 475) | Rent Office | `Rent-Office` |
| 2 | `lowcost` | (1141, 474) | Low Cost Housing | `Low-Cost` |
| 3 | `pawn` | (1614, 474) | Pawn Shop | `Pawn-Shop` |
| 4 | `discount` | (2049, 474) | Discount Store | `Discount-Store` |
| 5 | `frosty` | (2078, 925) | Frosty Burger | `Frosty-Burger` |
| 6 | `offrack` | (2058, 1373) | Off the Rack | `Off-the-Rack` |
| 7 | `electronics` | (2058, 1825) | Electronics | `Electricty` |
| 8 | `university` | (1613, 1825) | University | `University` |
| 9 | `employment` | (787, 1825) | Employment Office | `Employment-Office` |
| 10 | `factory` | (293, 1825) | Factory | `Factory` |
| 11 | `bank` | (239, 1375) | Bank | `Bank` |
| 12 | `tryandsave` | (249, 925) | Try and Save | `Try-and-Save` |

(The SVG group id `Electricty` is a real typo in the file — use it verbatim so UI lookups match.)

---

## Current state (from Plans 1 & 2, do not re-create)

- `game/data/board.ts` — `NodeId`, `BoardGraph {nodes: NodeId[]}`, `hopsBetween(graph,a,b)`, `testRing` (n0..n7).
- `game/data/buildings.ts` — `Service`, `ServiceKind`, `Building`, `BUILDINGS` (6 test buildings on n0..n5), a **load-time validation loop** against `testRing`, `buildingAt`, `hasService`.
- `game/data/world.ts` — `makeWorld(graph): World` (hardcodes `BUILDINGS`), `WORLD = makeWorld(testRing)`.
- `game/engine/world.ts` — `World { graph, buildings, jobs, courses, items, housing }`.
- `game/data/jobs.ts` — `JOBS` with `buildingId` "factory"/"tryandsave"; courses/items/housing tables.
- Tests across `game/` use `WORLD` (currently testRing-based) and node ids `n0`..`n5`.

---

## File Structure (this plan)

```
game/data/
  board.ts       ← MODIFY: add BOARD (13-node ring), NODE_XY, BOARD_SIZE (keep testRing)
  buildings.ts   ← MODIFY: rename current 6 → TEST_BUILDINGS; add real BUILDINGS (13); remove load-time guard
  world.ts       ← MODIFY: makeWorld(graph, buildings) + node validation; WORLD (real) + TEST_WORLD (test)
game/engine/
  realboard.test.ts ← Create: integration test on the real 13-node board
  (reducer.test.ts + actions/*.test.ts + playthrough.test.ts ← MODIFY: WORLD → TEST_WORLD)
```

---

## Task 1: Real board graph + node coordinates

**Files:**
- Modify: `game/data/board.ts`
- Test: `game/data/board.test.ts` (add a describe block / tests)

- [ ] **Step 1: Write the failing tests**

Append to `game/engine/board.test.ts`:
```ts
import { BOARD, NODE_XY, BOARD_SIZE } from "../data/board";

test("BOARD is a 13-node ring in clockwise order", () => {
  expect(BOARD.nodes).toEqual([
    "highsec", "rentoffice", "lowcost", "pawn", "discount", "frosty", "offrack",
    "electronics", "university", "employment", "factory", "bank", "tryandsave",
  ]);
});

test("hopsBetween works on the real board (shorter way around 13 nodes)", () => {
  expect(hopsBetween(BOARD, "highsec", "rentoffice")).toBe(1);
  expect(hopsBetween(BOARD, "highsec", "tryandsave")).toBe(1); // wraps backward
  expect(hopsBetween(BOARD, "highsec", "electronics")).toBe(6); // 7 fwd vs 6 back
});

test("NODE_XY has a coordinate for every board node, within the board", () => {
  for (const id of BOARD.nodes) {
    const xy = NODE_XY[id];
    expect(xy).toBeDefined();
    expect(xy.x).toBeGreaterThanOrEqual(0);
    expect(xy.x).toBeLessThanOrEqual(BOARD_SIZE.width);
    expect(xy.y).toBeGreaterThanOrEqual(0);
    expect(xy.y).toBeLessThanOrEqual(BOARD_SIZE.height);
  }
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun test game/engine/board.test.ts`
Expected: FAIL — `BOARD`/`NODE_XY`/`BOARD_SIZE` not exported.

- [ ] **Step 3: Add to `game/data/board.ts`**

Append (keep everything already there, including `testRing`):
```ts
// The real board: 13 waypoints from assets/board.svg, in clockwise ring order.
// Node ids equal building ids — every board space is exactly one building.
export const BOARD: BoardGraph = {
  nodes: [
    "highsec", "rentoffice", "lowcost", "pawn", "discount", "frosty", "offrack",
    "electronics", "university", "employment", "factory", "bank", "tryandsave",
  ],
};

// Board pixel size (matches the SVG viewBox) — used by the UI to place the token.
export const BOARD_SIZE = { width: 2300, height: 1850 } as const;

// Screen coordinate of each node's waypoint (extracted from the SVG diamonds).
export const NODE_XY: Record<NodeId, { x: number; y: number }> = {
  highsec: { x: 242, y: 474 },
  rentoffice: { x: 702, y: 475 },
  lowcost: { x: 1141, y: 474 },
  pawn: { x: 1614, y: 474 },
  discount: { x: 2049, y: 474 },
  frosty: { x: 2078, y: 925 },
  offrack: { x: 2058, y: 1373 },
  electronics: { x: 2058, y: 1825 },
  university: { x: 1613, y: 1825 },
  employment: { x: 787, y: 1825 },
  factory: { x: 293, y: 1825 },
  bank: { x: 239, y: 1375 },
  tryandsave: { x: 249, y: 925 },
};
```

- [ ] **Step 4: Run to verify it passes**

Run: `bun test game/engine/board.test.ts`
Expected: PASS (original 4 + 3 new).

- [ ] **Step 5: Commit**

```bash
git add game/data/board.ts game/engine/board.test.ts
git commit -m "feat(data): add real 13-node board graph and node coordinates"
```

---

## Task 2: Real building registry + remove load-time guard

Rename the current 6-building array to `TEST_BUILDINGS` (still on `testRing` nodes `n0`..`n5`, unchanged), add the real 13-building `BUILDINGS` on the real nodes, and remove the module-load validation loop (it moves into `makeWorld` in Task 3).

**Files:**
- Modify: `game/data/buildings.ts`
- Test: `game/data/buildings.test.ts`

- [ ] **Step 1: Update the test to cover both building sets**

Replace the entire contents of `game/data/buildings.test.ts` with:
```ts
// game/data/buildings.test.ts
import { test, expect } from "bun:test";
import { BUILDINGS, TEST_BUILDINGS, buildingAt, hasService } from "./buildings";
import { BOARD } from "./board";
import { testRing } from "./board";

test("every real building sits on a real board node, one per node", () => {
  const nodes = BUILDINGS.map((b) => b.node).sort();
  expect(nodes).toEqual([...BOARD.nodes].sort());
});

test("every test building sits on a testRing node", () => {
  for (const b of TEST_BUILDINGS) expect(testRing.nodes).toContain(b.node);
});

test("buildingAt finds the building on a node, or undefined", () => {
  expect(buildingAt(BUILDINGS, "bank")?.id).toBe("bank");
  expect(buildingAt(BUILDINGS, "nope")).toBeUndefined();
});

test("hasService detects a service kind on a building", () => {
  const bank = buildingAt(BUILDINGS, "bank")!;
  expect(hasService(bank, "bank")).toBe(true);
  expect(hasService(bank, "shop")).toBe(false);
});

test("the real board offers each core service somewhere", () => {
  const kinds = new Set(BUILDINGS.flatMap((b) => b.services.map((s) => s.kind)));
  for (const k of ["workplace", "hiring", "education", "shop", "bank", "housing"]) {
    expect(kinds.has(k as never)).toBe(true);
  }
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun test game/data/buildings.test.ts`
Expected: FAIL — `BUILDINGS` not on real nodes / `TEST_BUILDINGS` undefined.

- [ ] **Step 3: Rewrite `game/data/buildings.ts`**

Replace the file with (keeping the `Service`/`ServiceKind`/`Building` types, `buildingAt`, `hasService` exactly; renaming the old array and adding the real one; removing the load-time loop):
```ts
// game/data/buildings.ts
import type { NodeId } from "./board";
import type { JobId } from "../engine/state";
import type { CourseId } from "./courses";
import type { ItemId } from "../engine/state";
import type { HousingId } from "../engine/state";

export type Service =
  | { kind: "workplace" }                        // jobs reference this building via Job.buildingId
  | { kind: "hiring"; jobIds: JobId[] }          // apply for these jobs here
  | { kind: "education"; courseIds: CourseId[] }  // take these courses here
  | { kind: "shop"; itemIds: ItemId[] }          // buy these items here
  | { kind: "bank" }                             // deposit/withdraw/loan/repay
  | { kind: "housing"; housingIds: HousingId[] }; // rent these places here

export type ServiceKind = Service["kind"];

export interface Building {
  id: string;
  name: string;
  hitBoxId: string; // SVG group id the UI binds clicks to (Plan 4)
  node: NodeId;
  services: Service[];
}

// The real board: 13 buildings, one per ring node (node id === building id).
export const BUILDINGS: Building[] = [
  { id: "highsec", name: "High Security Apartments", hitBoxId: "High-Security", node: "highsec", services: [] },
  { id: "rentoffice", name: "Rent Office", hitBoxId: "Rent-Office", node: "rentoffice",
    services: [{ kind: "housing", housingIds: ["lowcost", "highsec"] }] },
  { id: "lowcost", name: "Low Cost Housing", hitBoxId: "Low-Cost", node: "lowcost", services: [] },
  { id: "pawn", name: "Pawn Shop", hitBoxId: "Pawn-Shop", node: "pawn",
    services: [{ kind: "shop", itemIds: ["tv"] }] },
  { id: "discount", name: "Discount Store", hitBoxId: "Discount-Store", node: "discount",
    services: [{ kind: "shop", itemIds: ["tv", "suit"] }] },
  { id: "frosty", name: "Frosty Burger", hitBoxId: "Frosty-Burger", node: "frosty",
    services: [{ kind: "shop", itemIds: ["burger"] }] },
  { id: "offrack", name: "Off the Rack", hitBoxId: "Off-the-Rack", node: "offrack",
    services: [{ kind: "shop", itemIds: ["suit"] }] },
  { id: "electronics", name: "Electronics", hitBoxId: "Electricty", node: "electronics",
    services: [{ kind: "shop", itemIds: ["tv"] }] },
  { id: "university", name: "University", hitBoxId: "University", node: "university",
    services: [{ kind: "education", courseIds: ["basics", "business", "engineering"] }] },
  { id: "employment", name: "Employment Office", hitBoxId: "Employment-Office", node: "employment",
    services: [{ kind: "hiring", jobIds: ["janitor", "clerk", "engineer"] }] },
  { id: "factory", name: "Factory", hitBoxId: "Factory", node: "factory",
    services: [{ kind: "workplace" }] },
  { id: "bank", name: "Bank", hitBoxId: "Bank", node: "bank",
    services: [{ kind: "bank" }] },
  { id: "tryandsave", name: "Try and Save", hitBoxId: "Try-and-Save", node: "tryandsave",
    services: [{ kind: "workplace" }, { kind: "shop", itemIds: ["burger", "suit"] }] },
];

// Small fixture wired to testRing (n0..n5) for engine unit tests.
export const TEST_BUILDINGS: Building[] = [
  { id: "factory", name: "Factory", hitBoxId: "Hit-Box18", node: "n0", services: [{ kind: "workplace" }] },
  { id: "tryandsave", name: "Try and Save", hitBoxId: "Hit-Box6", node: "n1",
    services: [{ kind: "workplace" }, { kind: "shop", itemIds: ["burger", "tv", "suit"] }] },
  { id: "employment", name: "Employment Office", hitBoxId: "Hit-Box20", node: "n2",
    services: [{ kind: "hiring", jobIds: ["janitor", "clerk", "engineer"] }] },
  { id: "university", name: "University", hitBoxId: "Hit-Box24", node: "n3",
    services: [{ kind: "education", courseIds: ["basics", "business", "engineering"] }] },
  { id: "bank", name: "Bank", hitBoxId: "Hit-Box4", node: "n4", services: [{ kind: "bank" }] },
  { id: "rentoffice", name: "Rent Office", hitBoxId: "Hit-Box16", node: "n5",
    services: [{ kind: "housing", housingIds: ["lowcost", "highsec"] }] },
];

export function buildingAt(buildings: Building[], node: NodeId): Building | undefined {
  return buildings.find((b) => b.node === node);
}

export function hasService(building: Building, kind: ServiceKind): boolean {
  return building.services.some((s) => s.kind === kind);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `bun test game/data/buildings.test.ts`
Expected: PASS (5 tests). NOTE: other suites that import `WORLD` may still pass here because `world.ts` hasn't changed yet (it still calls `makeWorld(testRing)` which references `BUILDINGS`). Do not run the full suite yet — `world.ts` is fixed in Task 3.

- [ ] **Step 5: Commit**

```bash
git add game/data/buildings.ts game/data/buildings.test.ts
git commit -m "feat(data): add real 13-building registry; keep TEST_BUILDINGS fixture"
```

> After this commit `world.ts` still does `makeWorld(testRing)` and references `BUILDINGS` (now the real 13 on real nodes) — the full suite is temporarily red. Task 3 fixes it in the same branch. (If running `bun test` between commits, expect failures in WORLD-based suites until Task 3 lands.)

---

## Task 3: World assembly + migrate unit tests to TEST_WORLD

`makeWorld` now takes the buildings explicitly and validates that every building node exists in the graph (the guard moved from `buildings.ts`). Export the real `WORLD` (real board) and `TEST_WORLD` (testRing fixture). Migrate every unit test that relied on the old testRing-based `WORLD` to use `TEST_WORLD`.

**Files:**
- Modify: `game/data/world.ts`
- Modify (rename `WORLD`→`TEST_WORLD`): `game/engine/reducer.test.ts`, `game/engine/playthrough.test.ts`, and `game/engine/actions/{work,applyForJob,takeClass,buy,bank,rent,endWeek}.test.ts`
- Test: `game/data/world.test.ts`

- [ ] **Step 1: Rewrite `game/data/world.ts`**

```ts
// game/data/world.ts
import type { World } from "../engine/world";
import type { BoardGraph } from "./board";
import { BOARD, testRing } from "./board";
import { BUILDINGS, TEST_BUILDINGS, type Building } from "./buildings";
import { JOBS } from "./jobs";
import { COURSES } from "./courses";
import { ITEMS } from "./items";
import { HOUSING } from "./housing";

// Assemble a World from a board graph + a building set, validating the wiring.
export function makeWorld(graph: BoardGraph, buildings: Building[]): World {
  for (const b of buildings) {
    if (!graph.nodes.includes(b.node)) {
      throw new Error(`Building ${b.id} wired to unknown node ${b.node}`);
    }
  }
  return { graph, buildings, jobs: JOBS, courses: COURSES, items: ITEMS, housing: HOUSING };
}

// The real game world (13-building board).
export const WORLD: World = makeWorld(BOARD, BUILDINGS);

// Controlled fixture for engine unit tests (testRing + the 6-building set).
export const TEST_WORLD: World = makeWorld(testRing, TEST_BUILDINGS);
```

- [ ] **Step 2: Write `game/data/world.test.ts`**

```ts
// game/data/world.test.ts
import { test, expect } from "bun:test";
import { makeWorld, WORLD, TEST_WORLD } from "./world";
import { BOARD } from "./board";
import { TEST_BUILDINGS } from "./buildings";

test("WORLD uses the real 13-node board", () => {
  expect(WORLD.graph.nodes.length).toBe(13);
  expect(WORLD.buildings.length).toBe(13);
});

test("TEST_WORLD uses the testRing fixture", () => {
  expect(TEST_WORLD.buildings).toBe(TEST_BUILDINGS);
});

test("makeWorld rejects a building wired to a node outside the graph", () => {
  const bad = [{ id: "x", name: "X", hitBoxId: "X", node: "nowhere", services: [] }];
  expect(() => makeWorld(BOARD, bad)).toThrow(/unknown node/i);
});
```

- [ ] **Step 3: Migrate the unit tests from `WORLD` to `TEST_WORLD`**

In each of these files, change the import and every usage of `WORLD` to `TEST_WORLD`:
- `game/engine/reducer.test.ts`
- `game/engine/playthrough.test.ts`
- `game/engine/actions/work.test.ts`
- `game/engine/actions/applyForJob.test.ts`
- `game/engine/actions/takeClass.test.ts`
- `game/engine/actions/buy.test.ts`
- `game/engine/actions/bank.test.ts`
- `game/engine/actions/rent.test.ts`
- `game/engine/actions/endWeek.test.ts`

Mechanical recipe per file: replace `import { WORLD } from "...data/world"` with `import { TEST_WORLD } from "...data/world"` (keep the relative path), then replace every bare `WORLD` token with `TEST_WORLD`. (In files that import `WORLD` alongside `CONFIG`, only the `WORLD` import changes.) Do not change node ids (`n0`..`n5`) or any assertions — `TEST_WORLD` is the testRing fixture those tests were written against, so behavior is identical.

- [ ] **Step 4: Run the full suite + typecheck**

Run: `bun test && bunx tsc --noEmit -p tsconfig.json`
Expected: all suites green (same counts as before plus the 3 new `world.test.ts` tests and Task 1's 3); tsc exits 0.

- [ ] **Step 5: Commit**

```bash
git add game/data/world.ts game/data/world.test.ts \
        game/engine/reducer.test.ts game/engine/playthrough.test.ts \
        game/engine/actions/work.test.ts game/engine/actions/applyForJob.test.ts \
        game/engine/actions/takeClass.test.ts game/engine/actions/buy.test.ts \
        game/engine/actions/bank.test.ts game/engine/actions/rent.test.ts \
        game/engine/actions/endWeek.test.ts
git commit -m "refactor(data): makeWorld(graph,buildings); real WORLD + TEST_WORLD; migrate unit tests"
```

---

## Task 4: Real-board integration test

Prove the engine plays on the real 13-node board: move between real building nodes (paying hop-based time), interact, and reach a win.

**Files:**
- Create: `game/engine/realboard.test.ts`

- [ ] **Step 1: Write the test**

```ts
// game/engine/realboard.test.ts
import { test, expect } from "bun:test";
import { applyAction, type Action } from "./reducer";
import { createGame } from "./state";
import { WORLD } from "../data/world"; // the REAL board

function run(start: ReturnType<typeof createGame>, actions: Action[]) {
  let g = start;
  for (const a of actions) {
    const r = applyAction(g, a, WORLD);
    if (!r.ok) throw new Error(`action ${a.type} rejected: ${r.reason}`);
    g = r.state;
  }
  return g;
}

test("buildings resolve on their own nodes on the real board", () => {
  // node id === building id, so a player standing on 'bank' is at the Bank.
  let g = createGame({ playerName: "Al", startNode: "bank", seed: 1 });
  g = applyAction(g, { type: "setGoals", goals: g.goals }, WORLD).state;
  g = { ...g, players: [{ ...g.players[0], cash: 500 }] };
  const r = applyAction(g, { type: "bank", op: "deposit", amount: 100 }, WORLD);
  expect(r.ok).toBe(true);
  expect(r.state.players[0].bank).toBe(100);
});

test("a player can travel the real ring, study, work, and win easy goals", () => {
  let g = createGame({ playerName: "Al", startNode: "university", seed: 3 });
  g = applyAction(g, {
    type: "setGoals",
    goals: { wealth: 100, happiness: 0, education: 20, career: 0 },
  }, WORLD).state;

  g = run(g, [
    { type: "takeClass", course: "basics" },     // at university: +20 education
    { type: "moveTo", node: "employment" },       // travel the ring
    { type: "applyForJob", job: "clerk" },        // needs education 20 ✓
    { type: "moveTo", node: "tryandsave" },        // clerk's workplace + a shop
    { type: "work" },                             // earn wage
    { type: "endWeek" },
  ]);

  expect(g.players[0].jobId).toBe("clerk");
  expect(g.players[0].education).toBeGreaterThanOrEqual(20);
  expect(g.phase).toBe("won");
});
```

> If the second test rejects a `moveTo` for lack of time, the chosen route exceeds the weekly budget on the larger ring — adjust the route to nearer nodes (the test, not the engine). The first test is the essential one (building resolution on real nodes); the second demonstrates a real-board week.

- [ ] **Step 2: Run to verify it passes**

Run: `bun test game/engine/realboard.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 3: Final full suite + typecheck**

Run: `bun test && bunx tsc --noEmit -p tsconfig.json`
Expected: all green; tsc exits 0.

- [ ] **Step 4: Commit**

```bash
git add game/engine/realboard.test.ts
git commit -m "test(engine): integration test on the real 13-node board"
```

---

## Done criteria for Plan 3

- `BOARD` (13 real nodes in ring order), `NODE_XY` (screen coords), and `BOARD_SIZE` exist in `game/data/board.ts`.
- `BUILDINGS` is the real 13-building registry wired to real nodes (node id === building id); `TEST_BUILDINGS` remains the testRing fixture.
- `makeWorld(graph, buildings)` validates wiring; `WORLD` is the real board, `TEST_WORLD` is the fixture; all unit tests run against `TEST_WORLD`.
- `bun test` green; strict `tsc` clean.
- An integration test plays a week on the real board to a win.

**Carried forward:**
- Plan 4 — Svelte 5 UI: render `assets/board.svg`, bind clicks to building groups (`hitBoxId`), draw + animate the token using `NODE_XY`, the center-panel dashboard (layout direction A), and `localStorage` persistence.
- Building content is intentionally lean (some buildings have richer services than others; High Security / Low Cost are display-only for now). Flesh out services/economy and the Tesla reinvention later.
```
