// game/engine/actions/setGoals.ts
import type { GameState, Stat } from "../state";
import type { World } from "../world";
import { type ApplyResult, ok, reject } from "../result";
import { gameLoop } from "../loop";

export interface SetGoalsAction {
  type: "setGoals";
  goals: Record<Stat, number>;
}

export function setGoals(state: GameState, action: SetGoalsAction, world: World): ApplyResult {
  if (state.phase !== "setup") {
    return reject(state, "Goals can only be set during setup.");
  }
  // Enter the loop at the first start-of-turn. The preflight runs (createGame
  // granted a meal, so it passes) and lands the player in "playing".
  return ok(gameLoop({ ...state, goals: { ...action.goals }, phase: "startTurn" }, world));
}
