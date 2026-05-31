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

  const i = state.current;
  const before = state.players[i];

  // Settlement order: interest → rent → promotion → happiness decay → reset time.
  const afterInterest = accrueInterest(before);
  const afterRent = settleRent(afterInterest);
  const afterPromo = checkPromotion(afterRent);
  const afterDecay = decayHappiness(afterPromo);
  const settled: Player = { ...afterDecay, timeLeft: CONFIG.weeklyTimeBudget };

  // Derive a human-readable line per effect that actually changed something.
  const lines: string[] = [];
  const bankInterest = afterInterest.bank - before.bank;
  if (bankInterest > 0) lines.push(`Bank paid you $${bankInterest} interest.`);
  const loanInterest = afterInterest.debt - before.debt;
  if (loanInterest > 0) lines.push(`Your loan accrued $${loanInterest} interest.`);
  const rentPaid = afterInterest.cash - afterRent.cash;
  if (rentPaid > 0) lines.push(`Paid $${rentPaid} rent.`);
  const rentToDebt = afterRent.debt - afterInterest.debt;
  if (rentToDebt > 0) lines.push(`Couldn't cover $${rentToDebt} rent — added to debt.`);
  if (afterPromo.careerLevel > afterRent.careerLevel) {
    lines.push(`Promoted to career level ${afterPromo.careerLevel}!`);
  }
  const happinessLost = afterPromo.happiness - afterDecay.happiness;
  if (happinessLost > 0) lines.push(`Happiness drifted down ${happinessLost}.`);
  if (lines.length === 0) lines.push("A quiet weekend.");

  const log: LogEntry[] = [
    ...state.log,
    ...lines.map((text) => ({ week: state.week, text })),
  ];
  const players = state.players.map((p, idx) => (idx === i ? settled : p));
  let next: GameState = { ...state, players, week: state.week + 1, log };

  if (hasWon(next, i)) {
    next = { ...next, phase: "won" };
  }
  return ok(next);
}
