# Jones Plan 5 — Interactions & Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Jones clone fully playable in the browser — set goals, act at buildings through center-panel screens, end the week with a settlement summary, win — with the game saved to `localStorage`, and fix the token-walk animation.

**Architecture:** The pure engine (9 actions, 88 tests) is already complete; Plan 5 is almost entirely the Svelte 5 view layer plus two small DOM-free helpers that get `bun test` coverage (road-walk geometry, save serialization) and one contained engine enhancement (itemized week-end logging). A single `screen` value in the UI store drives a `DialogPanel` that swaps the center-panel body; all player capabilities flow through the existing reducer via `gameStore.dispatch`. The token animates along the SVG `Road` path with `getPointAtLength` instead of jumping node-to-node.

**Tech Stack:** TypeScript (strict), Bun test, Svelte 5 (runes), Vite. Engine code is DOM-free; UI lives under `game/ui/`.

**Design spec:** `docs/superpowers/specs/2026-05-31-jones-plan-5-interactions-design.md`

---

## File Structure

**New (pure, unit-tested with `bun test`):**
- `game/ui/lib/roadWalk.ts` — node→path-offset mapping + shortest-arc math. DOM-free (caller supplies a sampler).
- `game/ui/lib/roadWalk.test.ts`
- `game/ui/lib/save.ts` — versioned serialize/deserialize of `{ state, screen }`. DOM-free (no `localStorage` access here).
- `game/ui/lib/save.test.ts`

**New (Svelte components, verified by running the app):**
- `game/ui/screens/GoalsScreen.svelte` — goal-setup (replaces auto-start).
- `game/ui/screens/HomeScreen.svelte` — newspaper feed + End Week.
- `game/ui/screens/BuildingScreen.svelte` — shared row-list for all six service types.
- `game/ui/screens/ActionRow.svelte` — one action row (name/subtitle/badges, disabled state).
- `game/ui/screens/WinScreen.svelte` — trophy + New Game.
- `game/ui/DialogPanel.svelte` — switches body on `screen`.

**Modified:**
- `game/engine/actions/endWeek.ts` — itemized settlement log lines.
- `game/engine/actions/endWeek.test.ts` — update the log assertion.
- `game/ui/stores/game.svelte.ts` — add `screen` state, `preview`, `startGame`, `goTo` road tween, `endWeek`, `save`/`load`/`newGame`, `attachRoad`; remove auto-start.
- `game/ui/Board.svelte` — attach the `#Road` path to the store; remove the token CSS transition (the rAF tween drives motion now).
- `game/ui/App.svelte` — mount `DialogPanel` in the panel region instead of `Hud` directly.

**Untouched:** the entire `game/engine/` except `endWeek`, all data tables, `game/ui/Hud.svelte` (reused as the pinned stats strip), `assets/board.svg`.

---

## Task 1: Road-walk geometry (pure)

**Files:**
- Create: `game/ui/lib/roadWalk.ts`
- Test: `game/ui/lib/roadWalk.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// game/ui/lib/roadWalk.test.ts
import { test, expect } from "bun:test";
import { nodeOffsets, shorterArc, wrap, type Sampler } from "./roadWalk";

// A 10×10 square perimeter, length 40, starting at (0,0) going clockwise:
// top edge 0..10, right edge 10..20, bottom 20..30, left 30..40.
const square: Sampler = (len) => {
  const d = ((len % 40) + 40) % 40;
  if (d <= 10) return { x: d, y: 0 };
  if (d <= 20) return { x: 10, y: d - 10 };
  if (d <= 30) return { x: 10 - (d - 20), y: 10 };
  return { x: 0, y: 10 - (d - 30) };
};

test("nodeOffsets maps each node to the nearest path offset", () => {
  const ids = ["top", "right", "bottom", "left"] as const;
  const xy = {
    top: { x: 5, y: 0 }, right: { x: 10, y: 5 },
    bottom: { x: 5, y: 10 }, left: { x: 0, y: 5 },
  };
  const off = nodeOffsets([...ids], xy, square, 40, 400);
  expect(Math.abs(off.top - 5)).toBeLessThan(0.5);
  expect(Math.abs(off.right - 15)).toBeLessThan(0.5);
  expect(Math.abs(off.bottom - 25)).toBeLessThan(0.5);
  expect(Math.abs(off.left - 35)).toBeLessThan(0.5);
});

test("shorterArc picks the shorter direction and signs it", () => {
  expect(shorterArc(35, 5, 40)).toBe(10);    // wrap forward past the seam
  expect(shorterArc(5, 35, 40)).toBe(-10);   // backward is shorter
  expect(shorterArc(0, 10, 40)).toBe(10);    // plain forward
});

test("wrap keeps an offset within [0, total)", () => {
  expect(wrap(45, 40)).toBe(5);
  expect(wrap(-5, 40)).toBe(35);
  expect(wrap(10, 40)).toBe(10);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test game/ui/lib/roadWalk.test.ts`
Expected: FAIL — `Cannot find module './roadWalk'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// game/ui/lib/roadWalk.ts
// Pure geometry for walking the player token along the board's Road path.
// DOM-free: the caller supplies a sampler (in the app,
// SVGPathElement.getPointAtLength) and the total path length, so this is
// unit-testable without a browser.

export interface Pt { x: number; y: number; }
export type Sampler = (len: number) => Pt;

// For each node, scan the path and record the offset whose sampled point is
// nearest to the node's screen coordinate. `samples` sets scan resolution.
export function nodeOffsets<K extends string>(
  nodeIds: K[],
  xy: Record<K, Pt>,
  sampleAt: Sampler,
  totalLength: number,
  samples = 720,
): Record<K, number> {
  const out = {} as Record<K, number>;
  for (const id of nodeIds) {
    const target = xy[id];
    let bestLen = 0;
    let bestD = Infinity;
    for (let s = 0; s <= samples; s++) {
      const len = (s / samples) * totalLength;
      const p = sampleAt(len);
      const dx = p.x - target.x;
      const dy = p.y - target.y;
      const d = dx * dx + dy * dy;
      if (d < bestD) { bestD = d; bestLen = len; }
    }
    out[id] = bestLen;
  }
  return out;
}

// Signed shortest delta from fromOff to toOff around a loop of `total` length.
// Result is in (-total/2, total/2]; add to fromOff (then wrap) to walk short.
export function shorterArc(fromOff: number, toOff: number, total: number): number {
  let d = (toOff - fromOff) % total;
  if (d < 0) d += total;          // [0, total)
  if (d > total / 2) d -= total;  // shorter direction
  return d;
}

export function wrap(off: number, total: number): number {
  return ((off % total) + total) % total;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test game/ui/lib/roadWalk.test.ts`
Expected: PASS — 3 tests.

- [ ] **Step 5: Commit**

```bash
git add game/ui/lib/roadWalk.ts game/ui/lib/roadWalk.test.ts
git commit -m "feat(ui): pure road-walk geometry (node offsets + shortest arc)"
```

---

## Task 2: Save serialization (pure)

**Files:**
- Create: `game/ui/lib/save.ts`
- Test: `game/ui/lib/save.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// game/ui/lib/save.test.ts
import { test, expect } from "bun:test";
import { serialize, deserialize } from "./save";
import { createGame } from "../../engine/state";

const sampleState = () => createGame({ playerName: "You", startNode: "tryandsave", seed: 7 });

test("serialize → deserialize round-trips state and screen", () => {
  const state = sampleState();
  const back = deserialize(serialize({ state, screen: "home" }));
  expect(back).not.toBeNull();
  expect(back!.screen).toBe("home");
  expect(back!.state.seed).toBe(7);
  expect(back!.state.players[0].position).toBe("tryandsave");
});

test("deserialize returns null for missing, garbage, or wrong-version data", () => {
  expect(deserialize(null)).toBeNull();
  expect(deserialize("not json")).toBeNull();
  expect(deserialize(JSON.stringify({ version: 999, state: sampleState(), screen: "home" }))).toBeNull();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test game/ui/lib/save.test.ts`
Expected: FAIL — `Cannot find module './save'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// game/ui/lib/save.ts
import type { GameState } from "../../engine/state";

const VERSION = 1;

export interface SaveData {
  state: GameState;
  screen: string;
}

interface Envelope extends SaveData { version: number; }

export function serialize(data: SaveData): string {
  const env: Envelope = { version: VERSION, ...data };
  return JSON.stringify(env);
}

// Returns null for anything we can't safely load (missing, malformed, or an
// incompatible save version) — the caller then starts a fresh game.
export function deserialize(raw: string | null): SaveData | null {
  if (!raw) return null;
  try {
    const env = JSON.parse(raw) as Partial<Envelope>;
    if (env.version !== VERSION || !env.state) return null;
    return { state: env.state as GameState, screen: env.screen ?? "home" };
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test game/ui/lib/save.test.ts`
Expected: PASS — 2 tests.

- [ ] **Step 5: Commit**

```bash
git add game/ui/lib/save.ts game/ui/lib/save.test.ts
git commit -m "feat(ui): versioned save serialize/deserialize"
```

---

## Task 3: Itemized week-end log

The home screen's newspaper feed renders `GameState.log`. Today `endWeek` appends a single `"Week N settled."` line. Make it append one line per settlement effect that occurred, derived from the engine's own intermediate results (no change to `economy.ts`).

**Files:**
- Modify: `game/engine/actions/endWeek.ts`
- Test: `game/engine/actions/endWeek.test.ts:33-38`

- [ ] **Step 1: Update the existing log test (now expects itemized lines)**

In `game/engine/actions/endWeek.test.ts`, replace the `"endWeek logs an entry for the week"` test (lines 33-38) with:

```ts
test("endWeek logs itemized settlement lines for the week", () => {
  const g = playing({ cash: 500, bank: 1000, debt: 0, weeklyRent: 40, happiness: 50 });
  const r = applyAction(g, { type: "endWeek" }, TEST_WORLD);
  const wk1 = r.state.log.filter((e) => e.week === 1);
  expect(wk1.length).toBeGreaterThanOrEqual(2);
  expect(wk1.some((e) => e.text.includes("interest"))).toBe(true);
  expect(wk1.some((e) => e.text.includes("rent"))).toBe(true);
  expect(wk1.some((e) => e.text.includes("Happiness"))).toBe(true);
});

test("endWeek logs a quiet-weekend line when nothing happened", () => {
  const g = playing({ cash: 0, bank: 0, debt: 0, weeklyRent: 0, happiness: 0 });
  const r = applyAction(g, { type: "endWeek" }, TEST_WORLD);
  const wk1 = r.state.log.filter((e) => e.week === 1);
  expect(wk1.length).toBe(1);
  expect(wk1[0].text).toBe("A quiet weekend.");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test game/engine/actions/endWeek.test.ts`
Expected: FAIL — the itemized test sees only `"Week 1 settled."`.

- [ ] **Step 3: Rewrite `endWeek` to build itemized lines**

Replace the body of `game/engine/actions/endWeek.ts` with:

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

  const i = state.current;
  const before = state.players[i];

  // Settlement order: interest → rent → promotion → happiness decay → reset time.
  const afterInterest = accrueInterest(before);
  const afterRent = settleRent(afterInterest);
  const afterPromo = checkPromotion(afterRent);
  const afterDecay = decayHappiness(afterPromo);
  const settled: Player = { ...afterDecay, timeLeft: CONFIG.weeklyTimeBudget };

  // Derive a human-readable line per effect that actually changed something.
  const lines: string[] = [];
  const bankInterest = afterInterest.bank - before.bank;
  if (bankInterest > 0) lines.push(`Bank paid you $${bankInterest} interest.`);
  const loanInterest = afterInterest.debt - before.debt;
  if (loanInterest > 0) lines.push(`Your loan accrued $${loanInterest} interest.`);
  const rentPaid = afterInterest.cash - afterRent.cash;
  if (rentPaid > 0) lines.push(`Paid $${rentPaid} rent.`);
  const rentToDebt = afterRent.debt - afterInterest.debt;
  if (rentToDebt > 0) lines.push(`Couldn't cover $${rentToDebt} rent — added to debt.`);
  if (afterPromo.careerLevel > afterRent.careerLevel) {
    lines.push(`Promoted to career level ${afterPromo.careerLevel}!`);
  }
  const happinessLost = afterPromo.happiness - afterDecay.happiness;
  if (happinessLost > 0) lines.push(`Happiness drifted down ${happinessLost}.`);
  if (lines.length === 0) lines.push("A quiet weekend.");

  const log: LogEntry[] = [
    ...state.log,
    ...lines.map((text) => ({ week: state.week, text })),
  ];
  const players = state.players.map((p, idx) => (idx === i ? settled : p));
  let next: GameState = { ...state, players, week: state.week + 1, log };

  if (hasWon(next, i)) {
    next = { ...next, phase: "won" };
  }
  return ok(next);
}
```

- [ ] **Step 4: Run the full engine suite to verify it passes**

Run: `bun test`
Expected: PASS — all tests green (88 prior + 1 new endWeek test; `playthrough`/`realboard` unaffected since they never assert log length).

- [ ] **Step 5: Typecheck the engine**

Run: `bunx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add game/engine/actions/endWeek.ts game/engine/actions/endWeek.test.ts
git commit -m "feat(engine): itemized week-end settlement log"
```

---

## Task 4: Rewrite the UI store (screen state, flows, persistence, road tween)

This is the hub. Replace the whole store. It: starts in `setup`/`goals` (no more auto-start), loads any save on init, exposes a `preview(action)` for disabling invalid rows, drives the screen state machine, animates the token along the road, and saves to `localStorage` on every week-end.

**Files:**
- Modify: `game/ui/stores/game.svelte.ts` (full rewrite)

- [ ] **Step 1: Replace the store contents**

```ts
// game/ui/stores/game.svelte.ts
import { applyAction, type Action } from "../../engine/reducer";
import { createGame, type GameState, type Player, type Stat } from "../../engine/state";
import { WORLD } from "../../data/world";
import { NODE_XY, type NodeId } from "../../data/board";
import { buildingAt } from "../../data/buildings";
import { nodeOffsets, shorterArc, wrap, type Pt } from "../lib/roadWalk";
import { serialize, deserialize } from "../lib/save";

const START_NODE: NodeId = "tryandsave";
const SAVE_KEY = "jones-save-v1";
const WALK_MS_PER_HALF = 2200; // time to traverse half the loop; scaled by arc length

// Screen is "goals" | "home" | "won" | a building id (NodeId === building id).
type Screen = string;

function newSetupGame(): GameState {
  // Starts in phase "setup": the GoalsScreen calls startGame() to begin.
  return createGame({ playerName: "You", startNode: START_NODE, seed: Date.now() >>> 0 });
}

function loadFromStorage(): { state: GameState; screen: Screen } | null {
  if (typeof localStorage === "undefined") return null;
  const data = deserialize(localStorage.getItem(SAVE_KEY));
  return data ? { state: data.state, screen: data.screen } : null;
}

const loaded = loadFromStorage();

let game = $state<GameState>(loaded ? loaded.state : newSetupGame());
let screen = $state<Screen>(loaded ? loaded.screen : "goals");
let lastError = $state<string | null>(null);
let tokenXY = $state<Pt>({ ...NODE_XY[loaded ? loaded.state.players[loaded.state.current].position : START_NODE] });
let walking = $state(false);

// Road path + per-node offsets, attached by Board.svelte once the SVG mounts.
let roadPath: SVGPathElement | null = null;
let roadLen = 0;
let offsets: Record<NodeId, number> | null = null;

function persist(): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(SAVE_KEY, serialize({ state: game, screen }));
}

function pointAt(len: number): Pt {
  const p = roadPath!.getPointAtLength(wrap(len, roadLen));
  return { x: p.x, y: p.y };
}

const raf = (cb: FrameRequestCallback) => requestAnimationFrame(cb);

export const gameStore = {
  get state(): GameState { return game; },
  get player(): Player { return game.players[game.current]; },
  get error(): string | null { return lastError; },
  get tokenXY(): Pt { return tokenXY; },
  get walking(): boolean { return walking; },
  get screen(): Screen { return screen; },

  // Board.svelte calls this once with the SVG <path id="Road"> element.
  attachRoad(path: SVGPathElement): void {
    roadPath = path;
    roadLen = path.getTotalLength();
    offsets = nodeOffsets(WORLD.graph.nodes, NODE_XY, (l) => {
      const pt = path.getPointAtLength(l);
      return { x: pt.x, y: pt.y };
    }, roadLen);
    tokenXY = { ...NODE_XY[game.players[game.current].position] };
  },

  // Dry-run a reducer action without committing — used to disable invalid rows.
  preview(action: Action) {
    return applyAction(game, action, WORLD);
  },

  // Commit an action. Returns true on success; sets lastError on rejection.
  dispatch(action: Action): boolean {
    const r = applyAction(game, action, WORLD);
    if (r.ok) { game = r.state; lastError = null; }
    else { lastError = r.reason ?? "Not allowed."; }
    return r.ok;
  },

  // Goal-setup → begin the week.
  startGame(goals: Record<Stat, number>): void {
    if (this.dispatch({ type: "setGoals", goals })) {
      screen = "home";
      persist();
    }
  },

  goHome(): void { screen = "home"; },

  // Walk to a building: the engine charges travel time instantly, then the
  // token tweens along the Road path while the building's screen opens.
  async goTo(node: NodeId): Promise<void> {
    if (walking || game.phase !== "playing") return;
    const from = game.players[game.current].position;
    if (from === node) { this.openBuilding(node); return; }
    if (!this.dispatch({ type: "moveTo", node })) return; // rejected (e.g. no time)
    this.openBuilding(node);
    await this.walkRoad(from, node);
  },

  openBuilding(node: NodeId): void { screen = node; },

  async walkRoad(from: NodeId, to: NodeId): Promise<void> {
    if (!roadPath || !offsets) { tokenXY = { ...NODE_XY[to] }; return; }
    const fromOff = offsets[from];
    const delta = shorterArc(fromOff, offsets[to], roadLen);
    const dur = Math.max(300, Math.round((Math.abs(delta) / (roadLen / 2)) * WALK_MS_PER_HALF));
    walking = true;
    await new Promise<void>((resolve) => {
      const t0 = performance.now();
      const tick = (now: number) => {
        const k = Math.min(1, (now - t0) / dur);
        tokenXY = pointAt(fromOff + delta * k);
        if (k < 1) raf(tick);
        else { tokenXY = { ...NODE_XY[to] }; resolve(); }
      };
      raf(tick);
    });
    walking = false;
  },

  endWeek(): void {
    if (this.dispatch({ type: "endWeek" })) {
      screen = game.phase === "won" ? "won" : "home";
      persist(); // autosave at each week-end
    }
  },

  save(): void { persist(); },

  newGame(): void {
    if (typeof localStorage !== "undefined") localStorage.removeItem(SAVE_KEY);
    game = newSetupGame();
    screen = "goals";
    lastError = null;
    walking = false;
    tokenXY = { ...NODE_XY[START_NODE] };
  },

  // The building whose screen is open, if `screen` is a building id.
  currentBuilding() {
    return buildingAt(WORLD.buildings, screen);
  },
};
```

- [ ] **Step 2: Typecheck the UI**

Run: `bun run ui:check`
Expected: no errors (the components that consume the new API don't exist yet, but the store itself typechecks).

- [ ] **Step 3: Commit**

```bash
git add game/ui/stores/game.svelte.ts
git commit -m "feat(ui): store screen state machine, road tween, persistence"
```

---

## Task 5: Board attaches the Road path; drop the token CSS transition

The rAF tween now sets `tokenXY` every frame, so the CSS `transition` on the token must go (it would fight the per-frame updates). Board also hands the `#Road` path element to the store on mount.

**Files:**
- Modify: `game/ui/Board.svelte`

- [ ] **Step 1: Attach the road on mount**

In `game/ui/Board.svelte`, replace the `onMount` body so it also wires the road path (keep the existing building-click loop):

```svelte
  onMount(() => {
    // Bind a click on each building group (event bubbles up from the artwork).
    for (const b of WORLD.buildings) {
      const el = container.querySelector<SVGElement>("#" + CSS.escape(b.hitBoxId));
      if (!el) { console.warn("No SVG group for building", b.id, b.hitBoxId); continue; }
      el.style.cursor = "pointer";
      el.addEventListener("click", () => { void gameStore.goTo(b.node); });
    }
    // Hand the Road path to the store so the token can tween along it.
    const road = container.querySelector<SVGPathElement>("#Road");
    if (road) gameStore.attachRoad(road);
    else console.warn("No #Road path found in board.svg");
  });
```

- [ ] **Step 2: Remove the token CSS transition**

In the `<style>` block of `game/ui/Board.svelte`, delete this line from `.token`:

```css
    transition: left 0.26s linear, top 0.26s linear;
```

(Leave the rest of `.token` and `.token.walking` unchanged.)

- [ ] **Step 3: Typecheck**

Run: `bun run ui:check`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add game/ui/Board.svelte
git commit -m "feat(ui): attach Road path to store; token tween replaces CSS transition"
```

---

## Task 6: GoalsScreen (replaces auto-start)

**Files:**
- Create: `game/ui/screens/GoalsScreen.svelte`

- [ ] **Step 1: Write the component**

```svelte
<!-- game/ui/screens/GoalsScreen.svelte -->
<script lang="ts">
  import { gameStore } from "../stores/game.svelte";
  import { CONFIG } from "../../data/config";
  import type { Stat } from "../../engine/state";

  type Row = { key: Stat; label: string; step: number; min: number };
  const rows: Row[] = [
    { key: "wealth",    label: "💰 Wealth",    step: 500, min: 500 },
    { key: "happiness", label: "😀 Happiness", step: 10,  min: 10 },
    { key: "education", label: "📘 Education",  step: 10,  min: 10 },
    { key: "career",    label: "📈 Career",     step: 1,   min: 1 },
  ];

  const presets: Record<string, Record<Stat, number>> = {
    Easy:   { wealth: 2000,  happiness: 50,  education: 50,  career: 3 },
    Normal: { ...CONFIG.defaultGoals },
    Hard:   { wealth: 10000, happiness: 150, education: 150, career: 7 },
  };

  let goals = $state<Record<Stat, number>>({ ...CONFIG.defaultGoals });

  function bump(r: Row, dir: 1 | -1) {
    goals[r.key] = Math.max(r.min, goals[r.key] + dir * r.step);
  }
  function applyPreset(name: string) { goals = { ...presets[name] }; }
</script>

<div class="goals">
  <h2>Set your targets to win</h2>
  <p class="hint">Reach all four to win. Higher = a longer game.</p>

  {#each rows as r (r.key)}
    <div class="row">
      <span class="nm">{r.label}</span>
      <span class="stepper">
        <button onclick={() => bump(r, -1)} aria-label="decrease">–</button>
        <span class="v">{r.key === "wealth" ? "$" : ""}{goals[r.key]}</span>
        <button onclick={() => bump(r, 1)} aria-label="increase">+</button>
      </span>
    </div>
  {/each}

  <div class="presets">
    {#each Object.keys(presets) as name (name)}
      <button class="ghost" onclick={() => applyPreset(name)}>{name}</button>
    {/each}
  </div>
  <button class="start" onclick={() => gameStore.startGame(goals)}>Start Game →</button>
</div>

<style>
  .goals { font-family: ui-sans-serif, system-ui, sans-serif; color: #2a2f1a; padding: 8px; }
  h2 { font-size: clamp(13px, 1.6vw, 18px); margin: 0 0 2px; }
  .hint { font-size: clamp(9px, 1vw, 12px); color: #777; margin: 0 0 8px; }
  .row { display: flex; align-items: center; justify-content: space-between; background: #fff; border-radius: 6px; padding: 5px 8px; margin-bottom: 5px; }
  .nm { font-size: clamp(11px, 1.2vw, 14px); font-weight: 600; }
  .stepper { display: flex; align-items: center; gap: 6px; }
  .stepper button { width: 22px; height: 22px; border-radius: 5px; border: 1px solid #cdd9e8; background: #fff; color: #4a90d9; font-weight: 700; cursor: pointer; }
  .v { font-size: clamp(11px, 1.2vw, 14px); font-weight: 700; min-width: 56px; text-align: center; }
  .presets { display: flex; gap: 6px; margin: 6px 0; }
  .ghost { flex: 1; background: #fff; color: #4a90d9; border: 1px solid #cdd9e8; border-radius: 6px; padding: 5px; font-size: 11px; font-weight: 700; cursor: pointer; }
  .start { width: 100%; background: #4a90d9; color: #fff; border: none; border-radius: 6px; padding: 8px; font-size: 13px; font-weight: 700; cursor: pointer; }
</style>
```

- [ ] **Step 2: Typecheck**

Run: `bun run ui:check`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add game/ui/screens/GoalsScreen.svelte
git commit -m "feat(ui): goal-setup screen"
```

---

## Task 7: ActionRow + BuildingScreen (workplace/hiring/education/shop/housing)

A reusable row, then the building screen that lists the right rows per service. Each row is disabled (greyed, with the rejection reason as its tooltip) when the reducer would reject the action — computed via `gameStore.preview`. Bank is handled in Task 8.

**Files:**
- Create: `game/ui/screens/ActionRow.svelte`
- Create: `game/ui/screens/BuildingScreen.svelte`

- [ ] **Step 1: Write ActionRow**

```svelte
<!-- game/ui/screens/ActionRow.svelte -->
<script lang="ts">
  type Badge = { text: string; kind?: "cost" };
  let { name, sub = "", badges = [], disabled = false, reason = "", onact }:
    { name: string; sub?: string; badges?: Badge[]; disabled?: boolean; reason?: string; onact: () => void } = $props();
</script>

<button class="row" class:disabled onclick={() => { if (!disabled) onact(); }} title={disabled ? reason : ""}>
  <span class="info">
    <span class="nm">{name}</span>
    {#if sub}<span class="sub">{sub}</span>{/if}
  </span>
  <span class="badges">
    {#each badges as b (b.text)}<span class="bdg" class:cost={b.kind === "cost"}>{b.text}</span>{/each}
  </span>
</button>

<style>
  .row { display: flex; align-items: center; justify-content: space-between; width: 100%; text-align: left;
    background: #fff; border: none; border-radius: 6px; padding: 6px 8px; margin-bottom: 5px; cursor: pointer; }
  .row.disabled { opacity: 0.5; cursor: not-allowed; }
  .info { display: flex; flex-direction: column; }
  .nm { font-size: clamp(11px, 1.2vw, 13px); font-weight: 600; color: #2a2f1a; }
  .sub { font-size: clamp(8px, 0.9vw, 10px); color: #777; }
  .badges { display: flex; gap: 4px; align-items: center; }
  .bdg { font-size: clamp(8px, 0.9vw, 10px); background: #eef3fa; color: #2c5d8f; border-radius: 4px; padding: 2px 5px; white-space: nowrap; }
  .bdg.cost { background: #fbeaea; color: #9a3b3b; }
</style>
```

- [ ] **Step 2: Write BuildingScreen**

```svelte
<!-- game/ui/screens/BuildingScreen.svelte -->
<script lang="ts">
  import { gameStore } from "../stores/game.svelte";
  import { WORLD } from "../../data/world";
  import { JOBS } from "../../data/jobs";
  import { COURSES } from "../../data/courses";
  import { ITEMS } from "../../data/items";
  import { HOUSING } from "../../data/housing";
  import { CONFIG } from "../../data/config";
  import { wageFor } from "../../engine/wages";
  import type { Action } from "../../engine/reducer";
  import ActionRow from "./ActionRow.svelte";
  import BankPanel from "./BankPanel.svelte";

  let { buildingId }: { buildingId: string } = $props();
  const building = $derived(WORLD.buildings.find((b) => b.id === buildingId));
  const player = $derived(gameStore.player);

  // Is the player's current job worked at this building?
  const myJobHere = $derived(
    player.jobId && JOBS[player.jobId]?.buildingId === buildingId ? JOBS[player.jobId] : null,
  );

  const dis = (a: Action) => { const r = gameStore.preview(a); return { disabled: !r.ok, reason: r.reason ?? "" }; };
</script>

<div class="screen">
  <div class="hd">
    <span class="t">{building?.name ?? "Building"}</span>
    <button class="back" onclick={() => gameStore.goHome()}>◂ Home</button>
  </div>

  {#if !building || building.services.length === 0}
    <p class="empty">Nothing to do here.</p>
  {/if}

  {#each building?.services ?? [] as svc (svc.kind)}
    {#if svc.kind === "workplace"}
      {#if myJobHere}
        {@const a = { type: "work" } as const}
        {@const d = dis(a)}
        <ActionRow name={`Work a shift — ${myJobHere.title}`}
          badges={[{ text: `💵 +$${wageFor(myJobHere, player.careerLevel)}` }, { text: `⏳ ${myJobHere.timeCost}` }]}
          disabled={d.disabled} reason={d.reason} onact={() => gameStore.dispatch(a)} />
      {:else}
        <p class="empty">You don't work here. Get hired at the Employment Office.</p>
      {/if}

    {:else if svc.kind === "hiring"}
      {#each svc.jobIds as id (id)}
        {@const job = JOBS[id]}
        {@const a = { type: "applyForJob", job: id } as const}
        {@const d = dis(a)}
        <ActionRow name={`Apply: ${job.title}`}
          sub={job.requiredEducation > 0 ? `needs Edu ${job.requiredEducation}` : "no requirements"}
          badges={[{ text: `💵 $${job.wage}/shift` }, { text: `⏳ ${CONFIG.applyJobTimeCost}` }]}
          disabled={d.disabled} reason={d.reason} onact={() => gameStore.dispatch(a)} />
      {/each}

    {:else if svc.kind === "education"}
      {#each svc.courseIds as id (id)}
        {@const c = COURSES[id]}
        {@const a = { type: "takeClass", course: id } as const}
        {@const d = dis(a)}
        <ActionRow name={c.name}
          badges={[{ text: `📘 +${c.educationGain}` }, { text: `⏳ ${c.timeCost}` }, { text: `$${c.cost}`, kind: "cost" }]}
          disabled={d.disabled} reason={d.reason} onact={() => gameStore.dispatch(a)} />
      {/each}

    {:else if svc.kind === "shop"}
      {#each svc.itemIds as id (id)}
        {@const it = ITEMS[id]}
        {@const a = { type: "buy", item: id } as const}
        {@const d = dis(a)}
        <ActionRow name={it.name}
          sub={it.clothing ? "clothing" : ""}
          badges={[...(it.happinessGain > 0 ? [{ text: `😀 +${it.happinessGain}` }] : []), { text: `⏳ ${it.timeCost}` }, { text: `$${it.cost}`, kind: "cost" }]}
          disabled={d.disabled} reason={d.reason} onact={() => gameStore.dispatch(a)} />
      {/each}

    {:else if svc.kind === "housing"}
      {#each svc.housingIds as id (id)}
        {@const h = HOUSING[id]}
        {@const a = { type: "rent", unit: id } as const}
        {@const d = dis(a)}
        <ActionRow name={h.name}
          sub={player.housingId === id ? "current home" : ""}
          badges={[{ text: `🏠 $${h.weeklyRent}/wk`, kind: "cost" }]}
          disabled={d.disabled} reason={d.reason} onact={() => gameStore.dispatch(a)} />
      {/each}

    {:else if svc.kind === "bank"}
      <BankPanel />
    {/if}
  {/each}
</div>

<style>
  .screen { font-family: ui-sans-serif, system-ui, sans-serif; padding: 8px; }
  .hd { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
  .hd .t { font-weight: 700; font-size: clamp(12px, 1.4vw, 15px); color: #2a2f1a; }
  .back { background: none; border: none; font-size: clamp(10px, 1.1vw, 12px); color: #4a90d9; cursor: pointer; }
  .empty { font-size: clamp(10px, 1.1vw, 12px); color: #8a8666; margin: 4px 0; }
</style>
```

> Note: `BankPanel` is created in Task 8. Until then `bun run ui:check` will report a missing module — that is expected and resolved by the next task. Do not commit this task until Task 8's `BankPanel.svelte` exists, so the tree always typechecks. (Tasks 7 and 8 share one commit at the end of Task 8.)

- [ ] **Step 3: Proceed to Task 8 (shared commit)**

Do not run `ui:check`/commit yet — `BankPanel.svelte` from Task 8 must exist first.

---

## Task 8: BankPanel (the amount-input screen)

Bank is the one service that needs an amount, not a single click. Four ops, each with an amount stepper and a Do button gated by `preview`.

**Files:**
- Create: `game/ui/screens/BankPanel.svelte`

- [ ] **Step 1: Write BankPanel**

```svelte
<!-- game/ui/screens/BankPanel.svelte -->
<script lang="ts">
  import { gameStore } from "../stores/game.svelte";
  import type { BankOp } from "../../engine/actions/bank";

  const player = $derived(gameStore.player);
  const ops: { op: BankOp; label: string }[] = [
    { op: "deposit",  label: "Deposit"  },
    { op: "withdraw", label: "Withdraw" },
    { op: "loan",     label: "Take Loan" },
    { op: "repay",    label: "Repay"    },
  ];

  let amount = $state(50);
  const STEP = 50;
  function bump(dir: 1 | -1) { amount = Math.max(STEP, amount + dir * STEP); }

  function dis(op: BankOp) {
    const r = gameStore.preview({ type: "bank", op, amount });
    return { disabled: !r.ok, reason: r.reason ?? "" };
  }
</script>

<div class="bank">
  <div class="balances">
    <span>💵 ${player.cash}</span><span>🏦 ${player.bank}</span>
    {#if player.debt > 0}<span class="debt">📉 ${player.debt}</span>{/if}
  </div>

  <div class="amount">
    <button onclick={() => bump(-1)} aria-label="less">–</button>
    <span class="v">${amount}</span>
    <button onclick={() => bump(1)} aria-label="more">+</button>
  </div>

  <div class="ops">
    {#each ops as o (o.op)}
      {@const d = dis(o.op)}
      <button class="op" disabled={d.disabled} title={d.disabled ? d.reason : ""}
        onclick={() => gameStore.dispatch({ type: "bank", op: o.op, amount })}>{o.label}</button>
    {/each}
  </div>
</div>

<style>
  .bank { font-family: ui-sans-serif, system-ui, sans-serif; color: #2a2f1a; }
  .balances { display: flex; gap: 10px; font-size: clamp(10px, 1.1vw, 13px); margin-bottom: 8px; }
  .balances .debt { color: #c22; }
  .amount { display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 8px; }
  .amount button { width: 26px; height: 26px; border-radius: 6px; border: 1px solid #cdd9e8; background: #fff; color: #4a90d9; font-weight: 700; cursor: pointer; }
  .amount .v { font-size: clamp(13px, 1.5vw, 16px); font-weight: 700; min-width: 70px; text-align: center; }
  .ops { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
  .op { background: #4a90d9; color: #fff; border: none; border-radius: 6px; padding: 7px; font-size: clamp(10px, 1.1vw, 13px); font-weight: 700; cursor: pointer; }
  .op:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
```

- [ ] **Step 2: Typecheck (Tasks 7 + 8 together)**

Run: `bun run ui:check`
Expected: no errors.

- [ ] **Step 3: Commit Tasks 7 + 8**

```bash
git add game/ui/screens/ActionRow.svelte game/ui/screens/BuildingScreen.svelte game/ui/screens/BankPanel.svelte
git commit -m "feat(ui): building screens for all six service types"
```

---

## Task 9: HomeScreen + WinScreen

**Files:**
- Create: `game/ui/screens/HomeScreen.svelte`
- Create: `game/ui/screens/WinScreen.svelte`

- [ ] **Step 1: Write HomeScreen**

```svelte
<!-- game/ui/screens/HomeScreen.svelte -->
<script lang="ts">
  import { gameStore } from "../stores/game.svelte";

  // Newest entries first, capped so the feed stays readable.
  const feed = $derived([...gameStore.state.log].reverse().slice(0, 6));
  const week = $derived(gameStore.state.week);
</script>

<div class="home">
  <div class="news">
    <div class="mast"><span>The Daily Jones</span><span>Wk {week}</span></div>
    {#if feed.length === 0}
      <p class="li muted">Click a building on the board to get started.</p>
    {:else}
      {#each feed as e, i (i)}<p class="li">{e.text}</p>{/each}
    {/if}
  </div>
  <button class="end" onclick={() => gameStore.endWeek()}>End Week →</button>
  <p class="tip">Click a building on the board to act.</p>
</div>

<style>
  .home { font-family: ui-sans-serif, system-ui, sans-serif; padding: 8px; }
  .news { background: #fffdf5; border: 1px solid #e7e0c4; border-radius: 6px; padding: 7px; margin-bottom: 8px; }
  .mast { font-family: Georgia, serif; font-weight: 700; font-size: clamp(11px, 1.2vw, 14px); border-bottom: 1px solid #ddd; padding-bottom: 3px; margin-bottom: 4px; display: flex; justify-content: space-between; }
  .li { font-size: clamp(9px, 1vw, 11px); color: #444; margin: 2px 0; }
  .li::before { content: "• "; color: #999; }
  .li.muted { color: #999; }
  .end { width: 100%; background: #4a90d9; color: #fff; border: none; border-radius: 6px; padding: 8px; font-size: clamp(11px, 1.2vw, 13px); font-weight: 700; cursor: pointer; }
  .tip { font-size: clamp(8px, 0.9vw, 10px); color: #8a8666; text-align: center; margin: 5px 0 0; }
</style>
```

- [ ] **Step 2: Write WinScreen**

```svelte
<!-- game/ui/screens/WinScreen.svelte -->
<script lang="ts">
  import { gameStore } from "../stores/game.svelte";

  const week = $derived(gameStore.state.week);
</script>

<div class="win">
  <div class="trophy">🏆</div>
  <h3>You made it to the Fast Lane!</h3>
  <p class="sub">All goals met by week {week}.</p>
  <button class="ng" onclick={() => gameStore.newGame()}>New Game</button>
</div>

<style>
  .win { font-family: ui-sans-serif, system-ui, sans-serif; color: #2a2f1a; text-align: center; padding: 10px; }
  .trophy { font-size: clamp(28px, 4vw, 40px); }
  h3 { margin: 4px 0; font-size: clamp(13px, 1.6vw, 18px); }
  .sub { font-size: clamp(10px, 1.1vw, 13px); color: #555; }
  .ng { margin-top: 8px; background: #4a90d9; color: #fff; border: none; border-radius: 6px; padding: 8px 16px; font-size: clamp(11px, 1.2vw, 13px); font-weight: 700; cursor: pointer; }
</style>
```

- [ ] **Step 3: Typecheck**

Run: `bun run ui:check`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add game/ui/screens/HomeScreen.svelte game/ui/screens/WinScreen.svelte
git commit -m "feat(ui): home (news + end week) and win screens"
```

---

## Task 10: DialogPanel + App wiring

Switch the panel body on `gameStore.screen`. The stats strip (`Hud`) stays pinned for everything except goal-setup. `App.svelte` mounts `DialogPanel` in the panel region.

**Files:**
- Create: `game/ui/DialogPanel.svelte`
- Modify: `game/ui/App.svelte:1-11`

- [ ] **Step 1: Write DialogPanel**

```svelte
<!-- game/ui/DialogPanel.svelte -->
<script lang="ts">
  import { gameStore } from "./stores/game.svelte";
  import Hud from "./Hud.svelte";
  import GoalsScreen from "./screens/GoalsScreen.svelte";
  import HomeScreen from "./screens/HomeScreen.svelte";
  import WinScreen from "./screens/WinScreen.svelte";
  import BuildingScreen from "./screens/BuildingScreen.svelte";

  const screen = $derived(gameStore.screen);
</script>

<div class="panel-body">
  {#if screen === "goals"}
    <GoalsScreen />
  {:else}
    <Hud />
    {#if screen === "home"}
      <HomeScreen />
    {:else if screen === "won"}
      <WinScreen />
    {:else}
      <BuildingScreen buildingId={screen} />
    {/if}
  {/if}
</div>

<style>
  .panel-body { width: 100%; height: 100%; }
</style>
```

- [ ] **Step 2: Wire App.svelte**

Replace the contents of `game/ui/App.svelte` lines 1-11 with:

```svelte
<script lang="ts">
  import Board from "./Board.svelte";
  import DialogPanel from "./DialogPanel.svelte";
</script>

<main>
  <div class="stage">
    <Board />
    <div class="panel"><DialogPanel /></div>
  </div>
</main>
```

(Leave the `<style>` block unchanged — `.panel` already positions over the cream Dialog region.)

- [ ] **Step 3: Typecheck and build**

Run: `bun run ui:check && bun run ui:build`
Expected: both succeed, no errors.

- [ ] **Step 4: Commit**

```bash
git add game/ui/DialogPanel.svelte game/ui/App.svelte
git commit -m "feat(ui): dialog panel screen switch; mount in app"
```

---

## Task 11: Full verification (engine + UI + play to win)

- [ ] **Step 1: Run the entire engine test suite**

Run: `bun test`
Expected: PASS — all engine tests plus the new `roadWalk` (3) and `save` (2) tests; 0 fail.

- [ ] **Step 2: Engine typecheck**

Run: `bunx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 3: UI typecheck + production build**

Run: `bun run ui:check && bun run ui:build`
Expected: no errors; build artifacts written.

- [ ] **Step 4: Run the app and play a full game**

Run: `bun run ui:dev`, open http://localhost:5173, and verify the full loop:
- Goal-setup appears first (no auto-start). Pick a preset, adjust a stepper, **Start**.
- Click a building → the token **walks along the road** (curving with it, hitting waypoints — not a straight chord) → that building's screen opens.
- At the **Employment Office** apply for Janitor; at the **Factory** the "Work a shift" row is enabled and earns money/spends time; rows you can't afford/reach are greyed with a tooltip reason.
- At the **University** take a class; at a **shop** buy an item; at the **Bank** deposit/withdraw with the amount stepper; at the **Rent Office** rent a place.
- **End Week** → the newspaper feed shows itemized settlement lines (interest/rent/decay), time refills, week advances.
- Reload the page → the game **resumes from the save** (same week/cash/position), not goal-setup.
- Set low goals (Easy or lower) and end weeks until you win → the **Win screen** shows; **New Game** clears the save and returns to goal-setup.

> Toolchain reminder (from project memory): plain `bun run ui:dev` (Vite) needs a restart to pick up edits; dev port is 5173.

- [ ] **Step 5: Final commit (if any verification fixes were needed)**

```bash
git add -A
git commit -m "chore: Plan 5 verification fixes"
```

(Skip if nothing changed.)

---

## Self-Review (completed during planning)

**Spec coverage:** A. token fix → Tasks 1, 4, 5. B. panel framework → Task 10. C. six screens → Tasks 7 (workplace/hiring/education/shop/housing) + 8 (bank). D. goal setup → Task 6. E. End Week + weekend summary → Task 3 (itemized log) + Task 9 (feed + button). F. persistence → Task 2 + Task 4 (`save`/`load`/`newGame`, autosave on week-end). G. testing → Tasks 1–3 (`bun test`) + Task 11 (run-verify). All covered.

**Spec correction:** the spec claimed `endWeek` already logs itemized settlement lines — it does not (only `"Week N settled."`). Task 3 adds the itemized logging the weekend summary needs and updates the one dependent test (`endWeek.test.ts:36-37`).

**Type consistency:** `gameStore.preview/dispatch/startGame/goTo/endWeek/goHome/newGame/save/attachRoad/screen` are defined in Task 4 and consumed unchanged in Tasks 5–10. Action literals match the engine: `{type:"work"}`, `{type:"applyForJob", job}`, `{type:"takeClass", course}`, `{type:"buy", item}`, `{type:"rent", unit}`, `{type:"bank", op, amount}`, `{type:"setGoals", goals}`, `{type:"endWeek"}`, `{type:"moveTo", node}`. `Service` discriminants (`workplace/hiring/education/shop/housing/bank`) and their id fields (`jobIds/courseIds/itemIds/housingIds`) match `data/buildings.ts`. `BankOp` imported from `engine/actions/bank.ts`. `roadWalk` exports (`nodeOffsets/shorterArc/wrap/Pt/Sampler`) match their uses.

**Placeholder scan:** Task 7 intentionally references `BankPanel` before it exists and defers its commit/typecheck to Task 8 — called out explicitly so the tree always typechecks at commit boundaries. No other forward references.
