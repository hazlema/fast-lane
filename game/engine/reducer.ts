// game/engine/reducer.ts
import type { GameState } from "./state";
import type { World } from "./world";
import { type ApplyResult, reject } from "./result";
import { setGoals, type SetGoalsAction } from "./actions/setGoals";
import { moveTo, type MoveToAction } from "./actions/moveTo";
import { work, type WorkAction } from "./actions/work";
import { applyForJob, type ApplyForJobAction } from "./actions/applyForJob";
import { takeClass, type TakeClassAction } from "./actions/takeClass";
import { enroll, type EnrollAction } from "./actions/enroll";
import { buy, type BuyAction } from "./actions/buy";
import { bank, type BankAction } from "./actions/bank";
import { rent, type RentAction } from "./actions/rent";
import { payRent, type PayRentAction } from "./actions/payRent";
import { endWeek, type EndWeekAction } from "./actions/endWeek";

export type Action = SetGoalsAction | MoveToAction | WorkAction | ApplyForJobAction | TakeClassAction | EnrollAction | BuyAction | BankAction | RentAction | PayRentAction | EndWeekAction;

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
    case "enroll":
      return enroll(state, action, world);
    case "buy":
      return buy(state, action, world);
    case "bank":
      return bank(state, action, world);
    case "rent":
      return rent(state, action, world);
    case "payRent":
      return payRent(state, action, world);
    case "endWeek":
      return endWeek(state, action, world);
    default: {
      const _exhaustive: never = action;
      return reject(state, `Unknown action: ${(_exhaustive as { type: string }).type}`);
    }
  }
}
