// game/engine/actions/endWeek.ts
import type { GameState, LogEntry } from "../state";
import type { World } from "../world";
import { type ApplyResult, ok, requirePlaying } from "../result";
import { accrueInterest, checkPromotion, decayHappiness } from "../economy";
import { makeRng } from "../rng";
import { nextIndex } from "../economyIndex";
import { isMonthEnd } from "../calendar";
import { hasWon } from "../winCheck";
import { startWeek } from "../week";

export interface EndWeekAction {
  type: "endWeek";
}

export function endWeek(state: GameState, _action: EndWeekAction, world: World): ApplyResult {
  const guard = requirePlaying(state, "end the week");
  if (guard) return guard;

  const i = state.current;
  const before = state.players[i];

  // 1. Re-roll the economy index for the coming week (seeded → deterministic).
  const economyIndex = nextIndex(state.economyIndex, makeRng(state.seed + state.week));

  // 2. Bank/loan interest.
  const afterInterest = accrueInterest(before);

  // 3. Monthly rent: at a month boundary, add this month's rent (× index) to the tab.
  let monthlyRent = 0;
  let afterRent = afterInterest;
  if (isMonthEnd(state.week) && afterInterest.housingId) {
    const unit = world.housing[afterInterest.housingId];
    if (unit) {
      monthlyRent = Math.round(unit.monthlyRent * economyIndex);
      afterRent = { ...afterInterest, rentDue: afterInterest.rentDue + monthlyRent };
    }
  }

  // 4. Promotion, 5. happiness decay.
  const afterPromo = checkPromotion(afterRent);
  const afterDecay = decayHappiness(afterPromo);

  // 6. Roll into the new week: one checklist owns home/time/penalties/resets.
  const { player: settled, events: weekStartNews } = startWeek(afterDecay, world);

  // News lines: settlement (this week) + how the new week opened (startWeek).
  const lines: string[] = [];
  const bankInterest = afterInterest.bank - before.bank;
  if (bankInterest > 0) lines.push(`Bank paid you $${bankInterest} interest.`);
  const loanInterest = afterInterest.debt - before.debt;
  if (loanInterest > 0) lines.push(`Your loan accrued $${loanInterest} interest.`);
  if (monthlyRent > 0) lines.push(`Rent of $${monthlyRent} came due — pay it at the Rent Office.`);
  if (afterPromo.careerLevel > afterRent.careerLevel) {
    lines.push(`Promoted to career level ${afterPromo.careerLevel}!`);
  }
  const happinessLost = afterPromo.happiness - afterDecay.happiness;
  if (happinessLost > 0) lines.push(`Happiness drifted down ${happinessLost}.`);
  lines.push(...weekStartNews);
  if (lines.length === 0) lines.push("A quiet weekend.");

  const log: LogEntry[] = [
    ...state.log,
    ...lines.map((text) => ({ week: state.week, text })),
  ];
  const players = state.players.map((p, idx) => (idx === i ? settled : p));
  let next: GameState = { ...state, players, week: state.week + 1, economyIndex, log };

  if (hasWon(next, i)) {
    next = { ...next, phase: "won" };
  }
  return ok(next);
}
