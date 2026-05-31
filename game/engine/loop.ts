// game/engine/loop.ts
//
// THE GAME LOOP — a state machine you can read top to bottom.
//
//   setup ──setGoals──▶ startTurn ──▶ playing ──endWeek──▶ endTurn ──▶ (won | startTurn)
//
// gameLoop() runs the automatic states (startTurn, endTurn). "playing" is where
// the player acts (work/study/buy/… handled by the reducer); "setup" and "won"
// just sit. setGoals and endWeek flip the phase to startTurn/endTurn and call
// gameLoop, so the whole turn cycle lives here.
import type { GameState, Player } from "./state";
import { createGame } from "./state";
import type { World } from "./world";
import { CONFIG } from "../data/config";
import { isEmployed, isFed, shouldBeFired } from "./checks";
import { accrueInterest, checkPromotion, decayHappiness } from "./economy";
import { makeRng } from "./rng";
import { nextIndex } from "./economyIndex";
import { isMonthEnd } from "./calendar";
import { hasWon } from "./winCheck";

/** Start a fresh game in the "setup" phase (grants starting items). */
export { createGame as newGame };

/** Replace the current player; return the new state. */
function setPlayer(state: GameState, player: Player): GameState {
  return { ...state, players: state.players.map((p, i) => (i === state.current ? player : p)) };
}

/** Append news lines, tagged with the current week. */
function addNews(state: GameState, lines: string[]): GameState {
  if (lines.length === 0) return state;
  return { ...state, log: [...state.log, ...lines.map((text) => ({ week: state.week, text }))] };
}

// Advance any automatic state. Call after flipping the phase; "playing", "setup"
// and "won" pass straight through (nothing automatic to do).
export function gameLoop(state: GameState, world: World): GameState {
  switch (state.phase) {
    case "startTurn": return startTurn(state, world);
    case "endTurn":   return endTurn(state, world);
    default:          return state;
  }
}

// START OF TURN — preflight checks, then hand control to the player.
// Each rule is one readable block; add clothing/sickness the same way.
export function startTurn(state: GameState, world: World): GameState {
  const you = state.players[state.current];
  const news: string[] = [];
  let time = CONFIG.weeklyTimeBudget;

  // You have to eat.
  if (!isFed(you)) {
    news.push("You have to eat! Lost 5 time this week.");
    time -= CONFIG.hungerTimePenalty;
  }

  // You have to show up for work.
  const skippedWork = isEmployed(you) && !you.workedThisWeek;
  const weeksSinceWorked = skippedWork ? you.weeksSinceWorked + 1 : 0;
  const fired = shouldBeFired({ ...you, weeksSinceWorked });
  if (fired) news.push("Fired — you stopped showing up. Find a new job at the Employment Office.");
  else if (skippedWork) news.push("Your boss noticed you skipped work this week.");

  // Ready to play: home, fresh time, flags reset for the new week.
  const home = world.buildings.find((b) => b.id === you.housingId)?.node ?? you.position;
  const ready: Player = {
    ...you,
    position: home,
    timeLeft: time,
    hungry: !isFed(you),
    ateThisWeek: false,
    workedThisWeek: false,
    jobId: fired ? null : you.jobId,
    weeksSinceWorked: fired ? 0 : weeksSinceWorked,
  };

  return addNews(setPlayer({ ...state, phase: "playing" }, ready), news);
}

// END OF TURN — settle the week's economy, then win or roll into the next turn.
export function endTurn(state: GameState, world: World): GameState {
  const you = state.players[state.current];
  const news: string[] = [];

  // Economy index re-rolls for the coming week (seeded → deterministic).
  const economyIndex = nextIndex(state.economyIndex, makeRng(state.seed + state.week));

  // Bank/loan interest.
  const afterInterest = accrueInterest(you);
  if (afterInterest.bank - you.bank > 0) news.push(`Bank paid you $${afterInterest.bank - you.bank} interest.`);
  if (afterInterest.debt - you.debt > 0) news.push(`Your loan accrued $${afterInterest.debt - you.debt} interest.`);

  // Monthly rent at a month boundary.
  let afterRent = afterInterest;
  if (isMonthEnd(state.week) && afterInterest.housingId) {
    const unit = world.housing[afterInterest.housingId];
    if (unit) {
      const due = Math.round(unit.monthlyRent * economyIndex);
      afterRent = { ...afterInterest, rentDue: afterInterest.rentDue + due };
      news.push(`Rent of $${due} came due — pay it at the Rent Office.`);
    }
  }

  // Promotion, then happiness decay.
  const afterPromo = checkPromotion(afterRent);
  if (afterPromo.careerLevel > afterRent.careerLevel) news.push(`Promoted to career level ${afterPromo.careerLevel}!`);
  const afterDecay = decayHappiness(afterPromo);
  if (afterPromo.happiness - afterDecay.happiness > 0) news.push(`Happiness drifted down ${afterPromo.happiness - afterDecay.happiness}.`);

  const settled = addNews(
    { ...setPlayer(state, afterDecay), week: state.week + 1, economyIndex },
    news,
  );

  // Goals met → you win; otherwise roll into the next turn's preflight.
  if (hasWon(settled, state.current)) return { ...settled, phase: "won" };
  return gameLoop({ ...settled, phase: "startTurn" }, world);
}
