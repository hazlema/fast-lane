// game/engine/reducer.ts
import type { GameState } from "./state";
import type { World } from "./world";
import { type ApplyResult, reject } from "./result";
import { setGoals, type SetGoalsAction } from "./actions/setGoals";
import { moveTo, type MoveToAction } from "./actions/moveTo";
import { work, type WorkAction } from "./actions/work";
import { applyForJob, type ApplyForJobAction } from "./actions/applyForJob";
import { takeClass, type TakeClassAction } from "./actions/takeClass";
import { buy, type BuyAction } from "./actions/buy";
import { bank, type BankAction } from "./actions/bank";
import { rent, type RentAction } from "./actions/rent";

export type Action = SetGoalsAction | MoveToAction | WorkAction | ApplyForJobAction | TakeClassAction | BuyAction | BankAction | RentAction;
// More action variants are added to this union as their handlers land (buy, …).

export { type ApplyResult } from "./result";

export function applyAction(state: GameState, action: Action, world: World): ApplyResult {
  switch (action.type) {
    case "setGoals":
      return setGoals(state, action, world);
    case "moveTo":
      return moveTo(state, action, world);
    case "work":
      return work(state, action, world);
    case "applyForJob":
      return applyForJob(state, action, world);
    case "takeClass":
      return takeClass(state, action, world);
    case "buy":
      return buy(state, action, world);
    case "bank":
      return bank(state, action, world);
    case "rent":
      return rent(state, action, world);
    default: {
      const _exhaustive: never = action;
      return reject(state, `Unknown action: ${(_exhaustive as { type: string }).type}`);
    }
  }
}
