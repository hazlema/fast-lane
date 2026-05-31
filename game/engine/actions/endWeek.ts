// game/engine/actions/endWeek.ts
import type { GameState, Player, LogEntry } from "../state";
import type { World } from "../world";
import { type ApplyResult, ok, reject } from "../result";
import { CONFIG } from "../../data/config";
import { accrueInterest, settleRent, checkPromotion, decayHappiness } from "../economy";
import { hasWon } from "../winCheck";

export interface EndWeekAction {
  type: "endWeek";
}

export function endWeek(state: GameState, _action: EndWeekAction, _world: World): ApplyResult {
  if (state.phase !== "playing") return reject(state, "Can only end the week while playing.");

  // Settlement order: interest → rent → promotion → happiness decay → reset time.
  const settle = (p: Player): Player => {
    let next = accrueInterest(p);
    next = settleRent(next);
    next = checkPromotion(next);
    next = decayHappiness(next);
    return { ...next, timeLeft: CONFIG.weeklyTimeBudget };
  };

  const players = state.players.map((p, i) => (i === state.current ? settle(p) : p));
  const log: LogEntry[] = [
    ...state.log,
    { week: state.week, text: `Week ${state.week} settled.` },
  ];
  let next: GameState = { ...state, players, week: state.week + 1, log };

  if (hasWon(next, state.current)) {
    next = { ...next, phase: "won" };
  }
  return ok(next);
}
