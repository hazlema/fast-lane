// game/engine/loop.ts
//
// THE GAME LOOP — one place to read, trace, and breakpoint the whole cycle.
//
// The engine is a pure reducer: there is no background while-loop. The game
// advances one player action at a time, and `step` is the SINGLE chokepoint
// every action flows through (the UI store calls it on each click). Turn entry
// and exit are just particular actions, named below so the cycle is legible:
//
//   newGame(opts)                              phase: "setup"
//        │                                     (createGame grants starting items)
//        │  step(state, setGoals)              → first start-of-turn preflight
//        ▼
//   ┌───────────────────────────────────────────────┐  phase: "playing"
//   │  one turn (week):                               │
//   │    step(state, work | study | buy | move | …)   │  many actions per week
//   │    step(state, endWeek) ──► settle the week + preflight the next
//   └───────────────────────────────────────────────┘
//        │  goals met when endWeek settles
//        ▼
//   phase: "won"
//
// Debugging: setTrace(fn) and every step reports { week, phase, action, ok,
// reason }. The store turns this on in dev, so the browser console shows the
// loop running live. setTrace(null) turns it off.
import type { GameState } from "./state";
import { createGame } from "./state";
import { applyAction, type Action } from "./reducer";
import type { ApplyResult } from "./result";
import type { World } from "./world";

/** Start a fresh game in the "setup" phase (grants starting items). */
export { createGame as newGame };

export interface TraceEntry {
  week: number;
  phase: GameState["phase"];
  action: Action;
  ok: boolean;
  reason?: string;
}
export type TraceFn = (entry: TraceEntry) => void;

let trace: TraceFn | null = null;

/** Observe every step (pass null to stop). Used for dev/console tracing. */
export function setTrace(fn: TraceFn | null): void {
  trace = fn;
}

/**
 * Advance the game by one action — the single point the whole loop runs
 * through. Pure (returns the next state); the only side effect is the optional
 * trace, which is how you watch what the game is doing.
 */
export function step(state: GameState, action: Action, world: World): ApplyResult {
  const result = applyAction(state, action, world);
  trace?.({ week: state.week, phase: state.phase, action, ok: result.ok, reason: result.reason });
  return result;
}
