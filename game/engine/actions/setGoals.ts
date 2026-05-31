// game/engine/actions/setGoals.ts
import type { GameState, Stat } from "../state";
import type { World } from "../world";
import { type ApplyResult, ok, reject, updateCurrent } from "../result";
import { startWeek } from "../week";

export interface SetGoalsAction {
  type: "setGoals";
  goals: Record<Stat, number>;
}

export function setGoals(state: GameState, action: SetGoalsAction, world: World): ApplyResult {
  if (state.phase !== "setup") {
    return reject(state, "Goals can only be set during setup.");
  }
  const started: GameState = { ...state, goals: { ...action.goals }, phase: "playing" };
  // Enter the loop and run the first start-of-turn preflight. createGame already
  // handed the player a meal (a starting item), so this preflight passes with a
  // full budget — no special case. Don't eat this week and next week gets docked.
  return ok(updateCurrent(started, (p) => startWeek(p, world).player));
}
