// game/engine/reducer.ts
import type { GameState } from "./state";
import type { World } from "./world";
import { type ApplyResult, reject } from "./result";
import { setGoals, type SetGoalsAction } from "./actions/setGoals";
import { moveTo, type MoveToAction } from "./actions/moveTo";

export type Action = SetGoalsAction | MoveToAction;
// More action variants are added to this union as their handlers land (work, buy, …).

export { type ApplyResult } from "./result";

export function applyAction(state: GameState, action: Action, world: World): ApplyResult {
  switch (action.type) {
    case "setGoals":
      return setGoals(state, action, world);
    case "moveTo":
      return moveTo(state, action, world);
    default: {
      const _exhaustive: never = action;
      return reject(state, `Unknown action: ${(_exhaustive as { type: string }).type}`);
    }
  }
}
