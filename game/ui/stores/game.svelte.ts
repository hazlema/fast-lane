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
