// game/ui/stores/game.svelte.ts
import { applyAction, type Action } from "../../engine/reducer";
import { createGame, type GameState, type Player, type Stat } from "../../engine/state";
import { WORLD } from "../../data/world";
import { NODE_XY, type NodeId } from "../../data/board";
import { monthOf } from "../../engine/calendar";
import { nodeOffsets, shorterArc, wrap, type Pt } from "../lib/roadWalk";

const START_NODE: NodeId = "lowcost"; // you begin at home (you start renting Low Cost Housing)
const WALK_MS_PER_HALF = 2200; // time to traverse half the loop; scaled by arc length

// Screen is "goals" | "home" | "won" | a building id (NodeId === building id).
type Screen = string;

function newSetupGame(): GameState {
  // Starts in phase "setup": the GoalsScreen calls startGame() to begin.
  return createGame({ playerName: "You", startNode: START_NODE, seed: Date.now() >>> 0, startHousing: "lowcost" });
}

// Saving/resuming is intentionally DISABLED during development: every load
// starts a fresh game at goal-setup so playtests aren't tainted by a stale
// resumed save. (Clear any old save left over from earlier builds.)
if (typeof localStorage !== "undefined") localStorage.removeItem("jones-save-v1");

let game = $state<GameState>(newSetupGame());
let screen = $state<Screen>("goals");
let lastError = $state<string | null>(null);
let tokenXY = $state<Pt>({ ...NODE_XY[START_NODE] });
let walking = $state(false);

// Transient feedback signal (e.g. job-application result). The id lets the
// overlay re-trigger its animation even when the same text repeats.
type Notice = { id: number; tone: "good" | "bad"; text: string };
let notice = $state<Notice | null>(null);
let noticeSeq = 0;

// Road path + per-node offsets, attached by Board.svelte once the SVG mounts.
let roadPath: SVGPathElement | null = null;
let roadLen = 0;
let offsets: Record<NodeId, number> | null = null;

function persist(): void {
  /* saving disabled during development — no-op */
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
  get economyIndex(): number { return game.economyIndex; },
  get month(): number { return monthOf(game.week); },
  get notice(): Notice | null { return notice; },

  // Raise a transient bit of feedback for the overlay to show.
  pushNotice(tone: "good" | "bad", text: string): void { notice = { id: ++noticeSeq, tone, text }; },

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
  // token tweens along the Road path. The building's screen only opens once
  // we ARRIVE — the dialog stays on its current content while travelling
  // (a future travel animation/audio will play during the walk).
  async goTo(node: NodeId): Promise<void> {
    if (walking || game.phase !== "playing") return;
    const from = game.players[game.current].position;
    if (from === node) { this.openBuilding(node); return; }
    if (!this.dispatch({ type: "moveTo", node })) return; // rejected (e.g. no time)
    await this.walkRoad(from, node); // travel first…
    this.openBuilding(node);         // …then open the building on arrival
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
      // The engine returned the player home; snap the token there to match.
      tokenXY = { ...NODE_XY[game.players[game.current].position] };
      persist(); // autosave at each week-end
    }
  },

  payRent(): void {
    if (this.dispatch({ type: "payRent" })) persist();
  },

  newGame(): void {
    game = newSetupGame();
    screen = "goals";
    lastError = null;
    walking = false;
    tokenXY = { ...NODE_XY[START_NODE] };
  },
};
