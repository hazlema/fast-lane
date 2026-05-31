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
