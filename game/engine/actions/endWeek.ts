// game/engine/actions/endWeek.ts
import type { GameState } from "../state";
import type { World } from "../world";
import { type ApplyResult, ok, requirePlaying } from "../result";
import { gameLoop } from "../loop";

export interface EndWeekAction {
  type: "endWeek";
}

export function endWeek(state: GameState, _action: EndWeekAction, world: World): ApplyResult {
  const guard = requirePlaying(state, "end the week");
  if (guard) return guard;
  // Hand the turn to the loop: settle this week, then win or roll into the next.
  return ok(gameLoop({ ...state, phase: "endTurn" }, world));
}
