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
