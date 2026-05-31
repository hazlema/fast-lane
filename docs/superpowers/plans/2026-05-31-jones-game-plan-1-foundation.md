# Jones Game — Plan 1: Foundation & Engine Core

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganize the repo and build a pure, headless TypeScript game engine that can set goals, move a player around the board (discrete waypoint hops), and detect a win — all covered by `bun test`.

**Architecture:** Pure functional engine. One serializable `GameState`, evolved only by `applyAction(state, action, graph) → { state, ok, reason? }`. No DOM, no Svelte, no I/O. The board graph and config are plain data passed in. This is Plan 1 of 3 (Foundation → Economy & Actions → Svelte UI).

**Tech Stack:** Bun (runtime + `bun test`), TypeScript. No external deps in the engine.

---

## File Structure (created in this plan)

```
game/
  data/
    config.ts            ← tunables (time budget, hop cost, starting money, default goals)
    board.ts             ← board graph types + hop-distance helper + a hand-built test ring
  engine/
    rng.ts               ← seeded deterministic RNG
    state.ts             ← Stat, Player, GameState types + createGame() factory
    movement.ts          ← travelCost() in time units
    winCheck.ts          ← wealthOf / statValue / hasWon
    reducer.ts           ← Action union + applyAction() (setGoals, moveTo)
    rng.test.ts  board.test.ts  state.test.ts  movement.test.ts  winCheck.test.ts  reducer.test.ts
```

Repo after reorg:
```
tools/    ← relocated asset pipeline + editor (index.ts, generate.ts, batch.ts, batch-core.ts,
            export-layout.ts, layout.html, *.json, generated/)
assets/   ← board.svg (copy of jones2.svg), sprites/ (clean PNGs)
archive/  ← jones.svg, jones.png, drawing-1.svg, backup.svg, jones.af, "export (copy)"
game/     ← the engine (this plan) and later ui/
docs/     ← specs + plans
```

---

## Task 1: Repo reorganization

**Files:**
- Move: editor/pipeline files → `tools/`
- Move: source art → `archive/`
- Create: `assets/board.svg`, `assets/sprites/`
- Modify: `package.json`, `tools/export-layout.ts` (export dir)

- [ ] **Step 1: Initialize git (enables the frequent-commit workflow)**

Run from `/home/frosty/Dev/bun3/assetgen`:
```bash
git init
printf "node_modules/\n.superpowers/\ntools/generated/\n" > .gitignore
git add -A && git commit -m "chore: snapshot existing asset pipeline before reorg"
```
Expected: a first commit containing the current files. (If you prefer not to use git, skip every "Commit" step in this plan.)

- [ ] **Step 2: Create the new directories**

```bash
mkdir -p tools assets/sprites archive game/data game/engine
```

- [ ] **Step 3: Move the asset pipeline + editor into `tools/`**

```bash
git mv index.ts generate.ts batch.ts batch-core.ts export-layout.ts layout.html \
       batch.json batch.example.json jones_buildings.json props.json layout.json \
       generated tools/
git mv export tools/sprites-src 2>/dev/null || mv export tools/sprites-src
```
Note: inter-file imports (`./generate`, `./batch-core`) and all `import.meta.dir` paths stay valid because the files move together.

- [ ] **Step 4: Move source/working art into `archive/`**

```bash
git mv jones.svg jones.png drawing-1.svg backup.svg jones.af archive/ 2>/dev/null || \
  mv jones.svg jones.png drawing-1.svg backup.svg jones.af archive/
mv "export (copy)" archive/ 2>/dev/null || true
mv "jones.af~lock~" archive/ 2>/dev/null || true
```

- [ ] **Step 5: Publish the board + sprites the game will read**

```bash
cp jones2.svg assets/board.svg
cp tools/sprites-src/*.png assets/sprites/ 2>/dev/null || true
git mv jones2.svg archive/jones2.svg 2>/dev/null || mv jones2.svg archive/jones2.svg
```
(`assets/board.svg` is the canonical board the game loads; `archive/jones2.svg` keeps the original around.)

- [ ] **Step 6: Point the editor's export at the shared sprites dir**

In `tools/export-layout.ts`, change the export target so the pipeline feeds the game directly.

Find:
```ts
const EXPORT_DIR = path.join(ROOT, "export");
```
Replace with:
```ts
const EXPORT_DIR = path.join(ROOT, "..", "assets", "sprites");
```

- [ ] **Step 7: Update `package.json` scripts to the new paths**

Replace the `scripts` block with:
```json
  "scripts": {
    "dev": "bun --watch tools/index.ts",
    "start": "bun tools/index.ts",
    "batch": "bun tools/batch.ts",
    "export": "bun tools/export-layout.ts",
    "test": "bun test"
  },
```

- [ ] **Step 8: Verify the editor still launches**

```bash
bun tools/index.ts &
sleep 1
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/
kill %1
```
Expected: prints `200` (the editor served `layout.html`). If you see a port message instead, the server bound successfully — Ctrl-C and continue.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "chore: reorganize repo into tools/, assets/, archive/, game/"
```

---

## Task 2: Config module

**Files:**
- Create: `game/data/config.ts`

- [ ] **Step 1: Write the config**

```ts
// game/data/config.ts
// Central tunables. Adjusting the economy = editing this file, not logic.
export const CONFIG = {
  weeklyTimeBudget: 60, // time units available each week
  hopCost: 5,           // time units per waypoint hop traveled
  startingCash: 200,
  startingBank: 0,
  defaultGoals: {
    wealth: 5000,
    happiness: 100,
    education: 100,
    career: 5,
  },
} as const;
```

- [ ] **Step 2: Commit**

```bash
git add game/data/config.ts
git commit -m "feat(engine): add config tunables"
```

---

## Task 3: Seeded RNG

**Files:**
- Create: `game/engine/rng.ts`
- Test: `game/engine/rng.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// game/engine/rng.test.ts
import { test, expect } from "bun:test";
import { makeRng, randInt } from "./rng";

test("same seed produces the same sequence", () => {
  const a = makeRng(123);
  const b = makeRng(123);
  expect([a(), a(), a()]).toEqual([b(), b(), b()]);
});

test("different seeds diverge", () => {
  const a = makeRng(1);
  const b = makeRng(2);
  expect(a()).not.toEqual(b());
});

test("randInt stays within inclusive bounds", () => {
  const next = makeRng(42);
  for (let i = 0; i < 1000; i++) {
    const n = randInt(next, 3, 7);
    expect(n).toBeGreaterThanOrEqual(3);
    expect(n).toBeLessThanOrEqual(7);
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test game/engine/rng.test.ts`
Expected: FAIL — `Cannot find module './rng'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// game/engine/rng.ts
// Deterministic PRNG (mulberry32). Same seed → same sequence, so tests are repeatable.
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return function next(): number {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Inclusive on both ends.
export function randInt(next: () => number, minInclusive: number, maxInclusive: number): number {
  return minInclusive + Math.floor(next() * (maxInclusive - minInclusive + 1));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test game/engine/rng.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add game/engine/rng.ts game/engine/rng.test.ts
git commit -m "feat(engine): add seeded deterministic RNG"
```

---

## Task 4: Board graph + hop distance

**Files:**
- Create: `game/data/board.ts`
- Test: `game/engine/board.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// game/engine/board.test.ts
import { test, expect } from "bun:test";
import { hopsBetween, testRing, type BoardGraph } from "../data/board";

test("testRing is an ordered loop of 8 nodes", () => {
  expect(testRing.nodes.length).toBe(8);
});

test("hopsBetween returns 0 for same node", () => {
  expect(hopsBetween(testRing, "n0", "n0")).toBe(0);
});

test("hopsBetween takes the shorter way around the ring", () => {
  // n0..n7 ring. n0 -> n6 forward is 6, backward is 2 → expect 2.
  expect(hopsBetween(testRing, "n0", "n6")).toBe(2);
  expect(hopsBetween(testRing, "n0", "n3")).toBe(3);
  expect(hopsBetween(testRing, "n0", "n4")).toBe(4); // tie → 4 either way
});

test("hopsBetween throws on unknown node", () => {
  expect(() => hopsBetween(testRing, "n0", "nope")).toThrow();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test game/engine/board.test.ts`
Expected: FAIL — `Cannot find module '../data/board'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// game/data/board.ts
// The board road is a single loop. Nodes are waypoints in ring order.
// (Real node data will be parsed from assets/board.svg in a later plan;
//  testRing is a hand-built stand-in so the engine is testable now.)
export type NodeId = string;

export interface BoardGraph {
  nodes: NodeId[]; // ordered ring; adjacency is implied by order (wraps around)
}

// Distance in waypoint hops, taking the shorter direction around the loop.
export function hopsBetween(graph: BoardGraph, a: NodeId, b: NodeId): number {
  const i = graph.nodes.indexOf(a);
  const j = graph.nodes.indexOf(b);
  if (i < 0) throw new Error(`unknown node: ${a}`);
  if (j < 0) throw new Error(`unknown node: ${b}`);
  const n = graph.nodes.length;
  const forward = (j - i + n) % n;
  const backward = (i - j + n) % n;
  return Math.min(forward, backward);
}

// Hand-built 8-node ring for tests and early engine work.
export const testRing: BoardGraph = {
  nodes: ["n0", "n1", "n2", "n3", "n4", "n5", "n6", "n7"],
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test game/engine/board.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add game/data/board.ts game/engine/board.test.ts
git commit -m "feat(engine): add board graph and hop-distance helper"
```

---

## Task 5: Game state + factory

**Files:**
- Create: `game/engine/state.ts`
- Test: `game/engine/state.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// game/engine/state.test.ts
import { test, expect } from "bun:test";
import { createGame } from "./state";
import { CONFIG } from "../data/config";

test("createGame starts in setup phase at week 1", () => {
  const g = createGame({ playerName: "Al", startNode: "n0", seed: 1 });
  expect(g.phase).toBe("setup");
  expect(g.week).toBe(1);
  expect(g.current).toBe(0);
});

test("createGame seeds one player with starting money and no time yet", () => {
  const g = createGame({ playerName: "Al", startNode: "n0", seed: 1 });
  expect(g.players).toHaveLength(1);
  const p = g.players[0];
  expect(p.name).toBe("Al");
  expect(p.position).toBe("n0");
  expect(p.cash).toBe(CONFIG.startingCash);
  expect(p.bank).toBe(CONFIG.startingBank);
  expect(p.debt).toBe(0);
  expect(p.happiness).toBe(0);
  expect(p.education).toBe(0);
  expect(p.careerLevel).toBe(0);
  expect(p.jobId).toBeNull();
  expect(p.travelMultiplier).toBe(1);
  expect(p.timeLeft).toBe(0); // time is granted when goals are set (week begins)
});

test("createGame uses default goals", () => {
  const g = createGame({ playerName: "Al", startNode: "n0", seed: 1 });
  expect(g.goals).toEqual({ ...CONFIG.defaultGoals });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test game/engine/state.test.ts`
Expected: FAIL — `Cannot find module './state'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// game/engine/state.ts
import type { NodeId } from "../data/board";
import { CONFIG } from "../data/config";

export type Stat = "wealth" | "happiness" | "education" | "career";
export type JobId = string;
export type ItemId = string;

export interface Player {
  id: string;
  name: string;
  position: NodeId;
  cash: number;
  bank: number;
  debt: number;
  happiness: number;
  education: number;
  careerLevel: number;
  jobId: JobId | null;
  experience: number;
  inventory: ItemId[];
  timeLeft: number;
  travelMultiplier: number;
}

export interface LogEntry {
  week: number;
  text: string;
}

export type Phase = "setup" | "playing" | "weekEnd" | "won";

export interface GameState {
  players: Player[];
  current: number;
  week: number;
  phase: Phase;
  goals: Record<Stat, number>;
  seed: number;
  log: LogEntry[];
}

export function createGame(opts: {
  playerName: string;
  startNode: NodeId;
  seed: number;
}): GameState {
  const player: Player = {
    id: "p0",
    name: opts.playerName,
    position: opts.startNode,
    cash: CONFIG.startingCash,
    bank: CONFIG.startingBank,
    debt: 0,
    happiness: 0,
    education: 0,
    careerLevel: 0,
    jobId: null,
    experience: 0,
    inventory: [],
    timeLeft: 0,
    travelMultiplier: 1,
  };
  return {
    players: [player],
    current: 0,
    week: 1,
    phase: "setup",
    goals: { ...CONFIG.defaultGoals },
    seed: opts.seed,
    log: [],
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test game/engine/state.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add game/engine/state.ts game/engine/state.test.ts
git commit -m "feat(engine): add game state types and createGame factory"
```

---

## Task 6: Movement cost

**Files:**
- Create: `game/engine/movement.ts`
- Test: `game/engine/movement.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// game/engine/movement.test.ts
import { test, expect } from "bun:test";
import { travelCost } from "./movement";
import { testRing } from "../data/board";
import { CONFIG } from "../data/config";

test("travelCost is hops × hopCost at default multiplier", () => {
  // n0 -> n3 = 3 hops; 3 × 5 = 15
  expect(travelCost(testRing, "n0", "n3", 1)).toBe(3 * CONFIG.hopCost);
});

test("travelCost is zero for staying put", () => {
  expect(travelCost(testRing, "n2", "n2", 1)).toBe(0);
});

test("travel multiplier discounts cost and rounds up", () => {
  // 3 hops × 5 = 15; ×0.6 = 9
  expect(travelCost(testRing, "n0", "n3", 0.6)).toBe(9);
  // 2 hops × 5 = 10; ×0.6 = 6
  expect(travelCost(testRing, "n0", "n6", 0.6)).toBe(6);
});

test("travel multiplier defaults to 1 when omitted", () => {
  expect(travelCost(testRing, "n0", "n3")).toBe(15);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test game/engine/movement.test.ts`
Expected: FAIL — `Cannot find module './movement'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// game/engine/movement.ts
import { hopsBetween, type BoardGraph, type NodeId } from "../data/board";
import { CONFIG } from "../data/config";

// Travel time in whole time units. Multiplier < 1 = faster (e.g. vehicle perk).
export function travelCost(
  graph: BoardGraph,
  from: NodeId,
  to: NodeId,
  travelMultiplier = 1,
): number {
  const hops = hopsBetween(graph, from, to);
  return Math.ceil(hops * CONFIG.hopCost * travelMultiplier);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test game/engine/movement.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add game/engine/movement.ts game/engine/movement.test.ts
git commit -m "feat(engine): add travel-cost calculation"
```

---

## Task 7: Win check

**Files:**
- Create: `game/engine/winCheck.ts`
- Test: `game/engine/winCheck.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// game/engine/winCheck.test.ts
import { test, expect } from "bun:test";
import { wealthOf, statValue, hasWon } from "./winCheck";
import { createGame } from "./state";

function gameWith(overrides: Partial<ReturnType<typeof createGame>["players"][number]>) {
  const g = createGame({ playerName: "Al", startNode: "n0", seed: 1 });
  g.goals = { wealth: 1000, happiness: 50, education: 50, career: 3 };
  g.players[0] = { ...g.players[0], ...overrides };
  return g;
}

test("wealthOf is cash + bank - debt", () => {
  const g = gameWith({ cash: 500, bank: 700, debt: 200 });
  expect(wealthOf(g.players[0])).toBe(1000);
});

test("statValue maps each stat correctly", () => {
  const g = gameWith({ cash: 1000, bank: 0, debt: 0, happiness: 12, education: 34, careerLevel: 2 });
  const p = g.players[0];
  expect(statValue(p, "wealth")).toBe(1000);
  expect(statValue(p, "happiness")).toBe(12);
  expect(statValue(p, "education")).toBe(34);
  expect(statValue(p, "career")).toBe(2);
});

test("hasWon is false when any goal is unmet", () => {
  const g = gameWith({ cash: 1000, bank: 0, debt: 0, happiness: 50, education: 50, careerLevel: 2 });
  expect(hasWon(g, 0)).toBe(false); // career 2 < 3
});

test("hasWon is true only when all goals are met or exceeded", () => {
  const g = gameWith({ cash: 1200, bank: 0, debt: 0, happiness: 60, education: 50, careerLevel: 3 });
  expect(hasWon(g, 0)).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test game/engine/winCheck.test.ts`
Expected: FAIL — `Cannot find module './winCheck'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// game/engine/winCheck.ts
import type { GameState, Player, Stat } from "./state";

export function wealthOf(p: Player): number {
  return p.cash + p.bank - p.debt;
}

export function statValue(p: Player, stat: Stat): number {
  switch (stat) {
    case "wealth":
      return wealthOf(p);
    case "happiness":
      return p.happiness;
    case "education":
      return p.education;
    case "career":
      return p.careerLevel;
  }
}

export function hasWon(state: GameState, playerIndex: number): boolean {
  const p = state.players[playerIndex];
  const stats = Object.keys(state.goals) as Stat[];
  return stats.every((s) => statValue(p, s) >= state.goals[s]);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test game/engine/winCheck.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add game/engine/winCheck.ts game/engine/winCheck.test.ts
git commit -m "feat(engine): add win-condition check"
```

---

## Task 8: Reducer (setGoals + moveTo)

**Files:**
- Create: `game/engine/reducer.ts`
- Test: `game/engine/reducer.test.ts`

The reducer is the single choke point: `applyAction(state, action, graph)`. It validates first and never partially applies. It returns `{ state, ok, reason? }` — on rejection, `state` is returned unchanged. State updates are immutable (new objects).

- [ ] **Step 1: Write the failing test**

```ts
// game/engine/reducer.test.ts
import { test, expect } from "bun:test";
import { applyAction } from "./reducer";
import { createGame } from "./state";
import { testRing } from "../data/board";
import { CONFIG } from "../data/config";

function newGame() {
  return createGame({ playerName: "Al", startNode: "n0", seed: 1 });
}

test("setGoals records goals and starts the week (playing, full time)", () => {
  const g = newGame();
  const goals = { wealth: 2000, happiness: 40, education: 30, career: 2 };
  const r = applyAction(g, { type: "setGoals", goals }, testRing);
  expect(r.ok).toBe(true);
  expect(r.state.phase).toBe("playing");
  expect(r.state.goals).toEqual(goals);
  expect(r.state.players[0].timeLeft).toBe(CONFIG.weeklyTimeBudget);
});

test("setGoals is rejected once already playing", () => {
  const g = newGame();
  const started = applyAction(g, { type: "setGoals", goals: g.goals }, testRing).state;
  const r = applyAction(started, { type: "setGoals", goals: g.goals }, testRing);
  expect(r.ok).toBe(false);
  expect(r.reason).toMatch(/setup/i);
  expect(r.state).toBe(started); // unchanged reference
});

test("moveTo deducts travel time and updates position", () => {
  const g = applyAction(newGame(), { type: "setGoals", goals: newGame().goals }, testRing).state;
  const r = applyAction(g, { type: "moveTo", node: "n3" }, testRing); // 3 hops × 5 = 15
  expect(r.ok).toBe(true);
  expect(r.state.players[0].position).toBe("n3");
  expect(r.state.players[0].timeLeft).toBe(CONFIG.weeklyTimeBudget - 15);
});

test("moveTo is rejected when not enough time remains", () => {
  let g = applyAction(newGame(), { type: "setGoals", goals: newGame().goals }, testRing).state;
  // Drain time down to 10 by editing a copy (engine-internal setup for the test).
  g = { ...g, players: [{ ...g.players[0], timeLeft: 10 }] };
  const r = applyAction(g, { type: "moveTo", node: "n3" }, testRing); // costs 15 > 10
  expect(r.ok).toBe(false);
  expect(r.reason).toMatch(/time/i);
  expect(r.state.players[0].position).toBe("n0"); // unchanged
  expect(r.state.players[0].timeLeft).toBe(10);   // unchanged
});

test("moveTo is rejected when not in playing phase", () => {
  const g = newGame(); // still in setup
  const r = applyAction(g, { type: "moveTo", node: "n3" }, testRing);
  expect(r.ok).toBe(false);
  expect(r.reason).toMatch(/playing/i);
});

test("moveTo to an unknown node is rejected, not thrown", () => {
  const g = applyAction(newGame(), { type: "setGoals", goals: newGame().goals }, testRing).state;
  const r = applyAction(g, { type: "moveTo", node: "ghost" }, testRing);
  expect(r.ok).toBe(false);
  expect(r.reason).toMatch(/node/i);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test game/engine/reducer.test.ts`
Expected: FAIL — `Cannot find module './reducer'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// game/engine/reducer.ts
import type { GameState, Player, Stat } from "./state";
import { CONFIG } from "../data/config";
import { type BoardGraph, type NodeId } from "../data/board";
import { travelCost } from "./movement";

export type Action =
  | { type: "setGoals"; goals: Record<Stat, number> }
  | { type: "moveTo"; node: NodeId };
// Economy actions (work, buy, bank, rent, takeClass, applyForJob, endWeek) arrive in Plan 2.

export interface ApplyResult {
  state: GameState;
  ok: boolean;
  reason?: string;
}

function reject(state: GameState, reason: string): ApplyResult {
  return { state, ok: false, reason };
}

// Immutably replace the current player with the result of `fn`.
function updateCurrent(state: GameState, fn: (p: Player) => Player): GameState {
  const players = state.players.map((p, i) => (i === state.current ? fn(p) : p));
  return { ...state, players };
}

export function applyAction(state: GameState, action: Action, graph: BoardGraph): ApplyResult {
  switch (action.type) {
    case "setGoals": {
      if (state.phase !== "setup") {
        return reject(state, "Goals can only be set during setup.");
      }
      const started: GameState = {
        ...state,
        goals: { ...action.goals },
        phase: "playing",
      };
      return {
        ok: true,
        state: updateCurrent(started, (p) => ({ ...p, timeLeft: CONFIG.weeklyTimeBudget })),
      };
    }

    case "moveTo": {
      if (state.phase !== "playing") {
        return reject(state, "Can only move while playing.");
      }
      if (!graph.nodes.includes(action.node)) {
        return reject(state, `Unknown node: ${action.node}`);
      }
      const player = state.players[state.current];
      const cost = travelCost(graph, player.position, action.node, player.travelMultiplier);
      if (cost > player.timeLeft) {
        return reject(state, "Not enough time to travel there.");
      }
      const next = updateCurrent(state, (p) => ({
        ...p,
        position: action.node,
        timeLeft: p.timeLeft - cost,
      }));
      return { ok: true, state: next };
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test game/engine/reducer.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Run the whole suite**

Run: `bun test`
Expected: PASS — all suites green (rng, board, state, movement, winCheck, reducer).

- [ ] **Step 6: Commit**

```bash
git add game/engine/reducer.ts game/engine/reducer.test.ts
git commit -m "feat(engine): add reducer with setGoals and moveTo actions"
```

---

## Done criteria for Plan 1

- Repo reorganized; editor still launches from `tools/` (`bun start` serves on :3000).
- `assets/board.svg` exists (copy of jones2.svg).
- `bun test` passes: seeded RNG, board hop-distance, state factory, travel cost, win check, and a reducer that handles `setGoals` and `moveTo` with full validation.
- A headless caller can: create a game → set goals (week begins, time granted) → move around the ring paying time → and `hasWon` correctly reports goal completion.

**Next:** Plan 2 — economy data tables, building registry, and the remaining actions (work / applyForJob / takeClass / buy / bank / rent / endWeek) with the full week-settlement loop.
