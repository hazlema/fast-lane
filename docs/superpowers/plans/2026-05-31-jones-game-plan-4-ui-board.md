# Jones Game — Plan 4: UI Foundation & Living Board

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the game *visible and interactive* for the first time: a Svelte 5 app that renders `assets/board.svg`, lets you click a building to walk the player token around the ring (paying time via the real engine), and shows a live HUD of week / time / money / stats.

**Architecture:** Svelte 5 (runes) + Vite, bootstrapped with `mount()`. A thin reactive **game store** (`game.svelte.ts`) wraps the already-tested pure engine: the UI only calls `dispatch(action)` / `goTo(node)` and renders state — it never mutates game state directly. The board SVG is inlined (`?raw`) so we can bind clicks to the building groups by their `hitBoxId`; the player token is an HTML element positioned over the board via `NODE_XY` percentages, animated hop-by-hop along the ring with CSS transitions.

**Tech Stack:** Svelte 5, Vite, TypeScript, Bun. Engine/data from Plans 1–3 (unchanged, imported).

**Prerequisite:** Plans 1–3 merged. Work on a new branch `game-ui`.

**Scope note:** This plan delivers the foundation + a walkable board with a live HUD. The center-panel **building screens** (work / study / shop / bank / rent), **goal-setup**, **end-week button**, **win screen**, and **localStorage persistence** are **Plan 5** — they all build on this store + board. To make the board immediately interactive, the store auto-starts a game with `CONFIG.defaultGoals` (the goal-setup screen replaces this in Plan 5).

**Testing approach:** Pure logic (`ringPath`) is TDD'd with `bun test`. Svelte components can't run under `bun test`, so their automated gates are **`bun run ui:build`** (Svelte compile + bundling) and **`bun run ui:check`** (`svelte-check` types). Visual behavior is verified in a browser (the controller drives it). If the toolchain setup in Task 1 fights back in an unexpected way, report BLOCKED rather than thrashing.

---

## File Structure (this plan)

```
index.html                 ← Vite entry (repo root)
vite.config.ts             ← Vite + svelte plugin
package.json               ← add deps + ui scripts
tsconfig.json              ← exclude game/ui (engine tsc stays clean)
game/data/board.ts         ← MODIFY: add ringPath() (pure, tested)
game/ui/
  tsconfig.json            ← svelte-check config for the UI
  main.ts                  ← mount(App)
  App.svelte               ← stage: <Board/> + <Hud/>
  Board.svelte             ← inlined board.svg, click binding, token
  Hud.svelte               ← live week/time/money/stats strip
  stores/game.svelte.ts    ← reactive store wrapping the engine
```

---

## Task 1: Svelte + Vite scaffold

**Files:**
- Create: `index.html`, `vite.config.ts`, `game/ui/main.ts`, `game/ui/App.svelte`, `game/ui/tsconfig.json`
- Modify: `package.json`, `tsconfig.json`

- [ ] **Step 1: Install dev dependencies**

```bash
bun add -d svelte @sveltejs/vite-plugin-svelte vite svelte-check
```
Expected: the four packages added to `devDependencies`.

- [ ] **Step 2: Add `vite.config.ts` (repo root)**

```ts
import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

// Vite root is the repo root; index.html lives there and loads game/ui/main.ts.
export default defineConfig({
  plugins: [svelte({ preprocess: vitePreprocess() })],
  build: { outDir: "dist", emptyOutDir: true },
  server: { port: 5173 },
});
```

- [ ] **Step 3: Add `index.html` (repo root)**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Jones in the Fast Lane</title>
    <style>
      html, body { margin: 0; height: 100%; background: #2f3a22; }
    </style>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/game/ui/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 4: Add `game/ui/main.ts`**

```ts
import { mount } from "svelte";
import App from "./App.svelte";

const app = mount(App, { target: document.getElementById("app")! });
export default app;
```

- [ ] **Step 5: Add a placeholder `game/ui/App.svelte`**

```svelte
<script lang="ts">
  // Placeholder — replaced in Task 5 once Board + Hud exist.
</script>

<main style="color:#e8e6cf; font-family: sans-serif; padding: 20px;">
  <h1>Jones — UI scaffold OK</h1>
</main>
```

- [ ] **Step 6: Add `game/ui/tsconfig.json` (for svelte-check)**

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ESNext", "DOM", "DOM.Iterable"],
    "types": ["svelte", "vite/client"],
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true,
    "isolatedModules": true,
    "allowImportingTsExtensions": true
  },
  "include": ["**/*.ts", "**/*.svelte", "../data/**/*.ts", "../engine/**/*.ts"]
}
```

- [ ] **Step 7: Exclude `game/ui` from the engine tsconfig**

In the root `tsconfig.json`, add an `exclude` (the engine typecheck must not try to parse `.svelte` files). The file currently has `"include": ["game"]`; add a sibling key:
```json
  "exclude": ["game/ui"]
```
(Place it after the `"include"` line, inside the top-level object.)

- [ ] **Step 8: Add UI scripts to `package.json`**

Add to the `scripts` block:
```json
    "ui:dev": "vite",
    "ui:build": "vite build",
    "ui:check": "svelte-check --tsconfig ./game/ui/tsconfig.json"
```

- [ ] **Step 9: Verify the scaffold builds and the engine still checks clean**

Run:
```bash
bun run ui:build && bunx tsc --noEmit -p tsconfig.json && bun test
```
Expected: Vite build succeeds (emits `dist/`), engine `tsc` exits 0, all engine tests still pass (84). If `bun run ui:check` is run it should also pass for the placeholder.

- [ ] **Step 10: Commit**

```bash
echo "dist/" >> .gitignore
git add index.html vite.config.ts game/ui/main.ts game/ui/App.svelte game/ui/tsconfig.json package.json bun.lock tsconfig.json .gitignore
git commit -m "feat(ui): scaffold Svelte 5 + Vite app"
```
(If the lockfile is named differently, add whatever `bun add` produced.)

---

## Task 2: ringPath helper (pure, tested)

The token walks node-by-node along the shorter arc of the ring. `ringPath` returns that inclusive node sequence.

**Files:**
- Modify: `game/data/board.ts`
- Test: `game/engine/board.test.ts` (append)

- [ ] **Step 1: Write the failing tests**

Append to `game/engine/board.test.ts`:
```ts
import { ringPath } from "../data/board";

test("ringPath returns just the node when from === to", () => {
  expect(ringPath(BOARD, "highsec", "highsec")).toEqual(["highsec"]);
});

test("ringPath walks the shorter (forward) arc, inclusive", () => {
  expect(ringPath(BOARD, "highsec", "pawn")).toEqual(["highsec", "rentoffice", "lowcost", "pawn"]);
});

test("ringPath walks backward when that is shorter", () => {
  // highsec(0) -> tryandsave(12): backward is 1 hop
  expect(ringPath(BOARD, "highsec", "tryandsave")).toEqual(["highsec", "tryandsave"]);
});

test("ringPath length matches hopsBetween + 1", () => {
  expect(ringPath(BOARD, "highsec", "electronics").length).toBe(hopsBetween(BOARD, "highsec", "electronics") + 1);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun test game/engine/board.test.ts`
Expected: FAIL — `ringPath` not exported.

- [ ] **Step 3: Implement in `game/data/board.ts`**

Append:
```ts
// The inclusive sequence of nodes from `from` to `to` along the shorter ring arc.
// Used by the UI to walk the token hop-by-hop.
export function ringPath(graph: BoardGraph, from: NodeId, to: NodeId): NodeId[] {
  const i = graph.nodes.indexOf(from);
  const j = graph.nodes.indexOf(to);
  if (i < 0) throw new Error(`unknown node: ${from}`);
  if (j < 0) throw new Error(`unknown node: ${to}`);
  const n = graph.nodes.length;
  const forward = (j - i + n) % n;
  const backward = (i - j + n) % n;
  const path: NodeId[] = [from];
  if (forward <= backward) {
    for (let k = 1; k <= forward; k++) path.push(graph.nodes[(i + k) % n]);
  } else {
    for (let k = 1; k <= backward; k++) path.push(graph.nodes[(i - k + n) % n]);
  }
  return path;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `bun test game/engine/board.test.ts`
Expected: PASS (existing + 4 new).

- [ ] **Step 5: Commit**

```bash
git add game/data/board.ts game/engine/board.test.ts
git commit -m "feat(data): add ringPath for token walk animation"
```

---

## Task 3: Game store

A reactive shell over the engine. Holds `GameState` in `$state`, exposes read-only getters (so reactivity survives module import), and `dispatch` / `goTo`. Auto-starts a game so the board is immediately playable.

**Files:**
- Create: `game/ui/stores/game.svelte.ts`

- [ ] **Step 1: Write the store**

```ts
// game/ui/stores/game.svelte.ts
import { applyAction, type Action } from "../../engine/reducer";
import { createGame, type GameState, type Player } from "../../engine/state";
import { WORLD } from "../../data/world";
import { CONFIG } from "../../data/config";
import { NODE_XY, ringPath, type NodeId } from "../../data/board";

const START_NODE: NodeId = "tryandsave";
const STEP_MS = 280; // per-hop walk duration

function freshGame(): GameState {
  const g = createGame({ playerName: "You", startNode: START_NODE, seed: Date.now() >>> 0 });
  // Auto-begin the week with default goals (goal-setup screen arrives in Plan 5).
  return applyAction(g, { type: "setGoals", goals: { ...CONFIG.defaultGoals } }, WORLD).state;
}

let game = $state<GameState>(freshGame());
let lastError = $state<string | null>(null);
let tokenXY = $state<{ x: number; y: number }>({ ...NODE_XY[START_NODE] });
let walking = $state(false);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Exported as an object of getters/methods so reactivity is preserved across imports.
export const gameStore = {
  get state(): GameState { return game; },
  get player(): Player { return game.players[game.current]; },
  get error(): string | null { return lastError; },
  get tokenXY() { return tokenXY; },
  get walking(): boolean { return walking; },

  dispatch(action: Action): boolean {
    const r = applyAction(game, action, WORLD);
    if (r.ok) { game = r.state; lastError = null; }
    else { lastError = r.reason ?? "Not allowed."; }
    return r.ok;
  },

  // Move to a building's node: the engine charges travel time instantly,
  // then we animate the token hop-by-hop along the ring for feedback.
  async goTo(node: NodeId): Promise<void> {
    if (walking) return;
    const from = game.players[game.current].position;
    if (from === node) return;
    if (!this.dispatch({ type: "moveTo", node })) return; // rejected (e.g. no time)
    walking = true;
    for (const step of ringPath(WORLD.graph, from, node).slice(1)) {
      tokenXY = { ...NODE_XY[step] };
      await sleep(STEP_MS);
    }
    walking = false;
  },

  newGame(): void {
    game = freshGame();
    tokenXY = { ...NODE_XY[START_NODE] };
    lastError = null;
    walking = false;
  },
};
```

- [ ] **Step 2: Type-check the store**

Run: `bun run ui:check`
Expected: no errors (the store references only existing engine/data exports).

- [ ] **Step 3: Commit**

```bash
git add game/ui/stores/game.svelte.ts
git commit -m "feat(ui): reactive game store wrapping the engine"
```

---

## Task 4: Board component

Inline the board SVG, hide the faint waypoint markers, bind a click on each building group (by `hitBoxId`) to `goTo(node)`, and render the player token positioned via `NODE_XY` percentages.

**Files:**
- Create: `game/ui/Board.svelte`

- [ ] **Step 1: Write `game/ui/Board.svelte`**

```svelte
<script lang="ts">
  import boardSvg from "../../assets/board.svg?raw";
  import { onMount } from "svelte";
  import { gameStore } from "./stores/game.svelte";
  import { WORLD } from "../data/world";
  import { BOARD_SIZE } from "../data/board";

  let container: HTMLDivElement;

  onMount(() => {
    // Bind a click on each building group (event bubbles up from the artwork).
    for (const b of WORLD.buildings) {
      const el = container.querySelector<SVGElement>("#" + CSS.escape(b.hitBoxId));
      if (!el) { console.warn("No SVG group for building", b.id, b.hitBoxId); continue; }
      el.style.cursor = "pointer";
      el.addEventListener("click", () => { void gameStore.goTo(b.node); });
    }
  });

  const xpct = (x: number) => (x / BOARD_SIZE.width) * 100;
  const ypct = (y: number) => (y / BOARD_SIZE.height) * 100;
</script>

<div class="board" bind:this={container}>
  {@html boardSvg}
  <div
    class="token"
    class:walking={gameStore.walking}
    style="left:{xpct(gameStore.tokenXY.x)}%; top:{ypct(gameStore.tokenXY.y)}%"
    title="You"
  ></div>
</div>

<style>
  .board { position: absolute; inset: 0; }
  .board :global(svg) { width: 100%; height: 100%; display: block; }
  /* Hide the faint waypoint diamonds in-game (they're a dev aid). */
  .board :global(#Waypoints) { display: none; }

  .token {
    position: absolute;
    width: 3%;
    aspect-ratio: 1;
    border-radius: 50%;
    background: radial-gradient(circle at 35% 30%, #ff7a7a, #d61f1f 70%);
    border: 3px solid #fff;
    box-shadow: 0 3px 7px #0008;
    transform: translate(-50%, -50%);
    transition: left 0.26s linear, top 0.26s linear;
    z-index: 5;
    pointer-events: none;
  }
  .token.walking { filter: brightness(1.15); }
</style>
```

- [ ] **Step 2: Build + type-check**

Run: `bun run ui:build && bun run ui:check`
Expected: build succeeds; svelte-check clean. (The `?raw` import of `../../assets/board.svg` resolves to repo-root `assets/board.svg`.)

- [ ] **Step 3: Commit**

```bash
git add game/ui/Board.svelte
git commit -m "feat(ui): board component — inline SVG, clickable buildings, player token"
```

---

## Task 5: HUD + App wiring

A live HUD strip over the center panel region, and the App stage that sizes the board and overlays the HUD.

**Files:**
- Create: `game/ui/Hud.svelte`
- Modify: `game/ui/App.svelte`

- [ ] **Step 1: Write `game/ui/Hud.svelte`**

```svelte
<script lang="ts">
  import { gameStore } from "./stores/game.svelte";
  import { wealthOf } from "../engine/winCheck";

  const player = $derived(gameStore.player);
  const goals = $derived(gameStore.state.goals);
  const stats = $derived([
    { key: "wealth", label: "Wealth", val: wealthOf(player), goal: goals.wealth },
    { key: "happiness", label: "Happy", val: player.happiness, goal: goals.happiness },
    { key: "education", label: "Edu", val: player.education, goal: goals.education },
    { key: "career", label: "Career", val: player.careerLevel, goal: goals.career },
  ]);
  const pct = (v: number, g: number) => g <= 0 ? 100 : Math.min(100, Math.round((v / g) * 100));
</script>

<div class="hud">
  <div class="top">
    <span class="chip">Week <b>{gameStore.state.week}</b></span>
    <span class="chip">⏳ <b>{player.timeLeft}</b></span>
    <span class="chip">💵 <b>${player.cash}</b></span>
    <span class="chip">🏦 <b>${player.bank}</b></span>
    {#if player.debt > 0}<span class="chip debt">📉 <b>${player.debt}</b></span>{/if}
  </div>
  <div class="stats">
    {#each stats as s (s.key)}
      <div class="stat">
        <div class="lbl">{s.label} <span>{s.val}/{s.goal}</span></div>
        <div class="bar"><i style="width:{pct(s.val, s.goal)}%"></i></div>
      </div>
    {/each}
  </div>
  {#if gameStore.error}<div class="err">{gameStore.error}</div>{/if}
</div>

<style>
  .hud { font-family: ui-sans-serif, system-ui, sans-serif; color: #2a2f1a; display: flex; flex-direction: column; gap: 6px; padding: 8px; }
  .top { display: flex; gap: 6px; flex-wrap: wrap; }
  .chip { background: #fff; border-radius: 6px; padding: 3px 8px; font-size: clamp(9px, 1.1vw, 14px); }
  .chip b { color: #1a2412; }
  .chip.debt b { color: #c22; }
  .stats { display: flex; gap: 6px; }
  .stat { flex: 1; background: #fff; border-radius: 6px; padding: 4px 6px; }
  .lbl { font-size: clamp(8px, 0.9vw, 12px); color: #555; display: flex; justify-content: space-between; }
  .bar { height: 5px; background: #e3e3d8; border-radius: 3px; margin-top: 3px; overflow: hidden; }
  .bar i { display: block; height: 100%; background: #4a90d9; }
  .err { background: #fbe0e0; color: #a01; border-radius: 6px; padding: 4px 8px; font-size: 12px; }
</style>
```

- [ ] **Step 2: Replace `game/ui/App.svelte`**

```svelte
<script lang="ts">
  import Board from "./Board.svelte";
  import Hud from "./Hud.svelte";
</script>

<main>
  <div class="stage">
    <Board />
    <div class="panel"><Hud /></div>
  </div>
</main>

<style>
  main { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 12px; }
  /* The stage matches the board's aspect ratio so overlays align to the artwork. */
  .stage { position: relative; width: 100%; max-width: 1100px; aspect-ratio: 2300 / 1850; }
  /* Overlay the HUD on the cream center panel region (Dialog bounds in the SVG). */
  .panel {
    position: absolute;
    left: 22%; top: 30%; width: 56%; height: 40%;
    overflow: auto;
  }
</style>
```

- [ ] **Step 3: Build + type-check**

Run: `bun run ui:build && bun run ui:check && bunx tsc --noEmit -p tsconfig.json && bun test`
Expected: UI build + svelte-check clean; engine tsc exits 0; engine tests pass (88 now: 84 + 4 ringPath).

- [ ] **Step 4: Visual verification (controller, in a browser)**

Start the dev server: `bun run ui:dev` (serves at http://localhost:5173). In the browser confirm:
- The board renders with the cream panel showing the HUD (Week 1, time 60, $200, four stat bars), no visible waypoint diamonds.
- The red token sits on Try and Save (start node).
- Clicking a building walks the token hop-by-hop around the ring to that building, and **time-left decreases** by the hop cost (5 per hop). Clicking a far building costs more.
- Clicking when time is too low shows the rejection message in the HUD and the token doesn't move.

- [ ] **Step 5: Commit**

```bash
git add game/ui/Hud.svelte game/ui/App.svelte
git commit -m "feat(ui): live HUD + app stage; clickable walkable board"
```

---

## Done criteria for Plan 4

- `bun run ui:build` and `bun run ui:check` are clean; engine `tsc` + `bun test` still green (88 tests).
- Opening the dev server shows the real board with a live HUD and a player token.
- Clicking a building walks the token around the ring and deducts travel time through the real engine; invalid moves are rejected with a message.
- `ringPath` is unit-tested.

**Carried forward (Plan 5):**
- Center-panel **building screens** per service (workplace/hiring/education/shop/bank/housing) so you can actually work, study, shop, bank, and rent.
- **Goal-setup** screen (replacing the auto-start defaults), **End Week** button, and **win screen**.
- **localStorage** persistence (autosave + load + New Game) — `GameState` is already serializable.
- Token walk currently animates after time is charged; consider disabling building clicks while `walking` (the store already guards re-entrancy) and richer arrival feedback.
- Tighten `NODE_XY` typing (the `Record<string,…>` undefined-risk noted in Plan 3) now that the UI consumes coordinates.
```
