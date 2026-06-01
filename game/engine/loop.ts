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
import { isEmployed, isFed, shouldBeFired, shouldBeEvicted, ownsFridge } from "./checks";
import { accrueInterest, checkPromotion, decayHappiness } from "./economy";
import { makeRng } from "./rng";
import { nextIndex } from "./economyIndex";
import { isMonthEnd } from "./calendar";
import { rollWeekendEvent } from "./events";
import { rollCrisis } from "./crisis";
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
  let cash = you.cash;
  let debt = you.debt;
  let sickWeeks = you.sickWeeks;

  // You have to eat — a fresh meal, or cook one from your frozen stock; else go
  // hungry. Frozen groceries only keep if you own a fridge: with no fridge they
  // spoil, and eating one gives you food poisoning (a doctor's bill + sickness).
  let mealsStocked = you.mealsStocked;
  let fed = isFed(you);
  if (mealsStocked > 0 && !ownsFridge(you)) {
    if (!fed) {
      fed = true;                          // you ate the spoiled burger…
      sickWeeks = CONFIG.sicknessWeeks;    // …and it made you sick
      const paid = Math.min(cash, CONFIG.doctorBill);
      cash -= paid;
      debt += CONFIG.doctorBill - paid;    // can't cover it → you owe the doctor
      news.push(`🤢 No fridge — your frozen burger spoiled and made you sick. Doctor's bill $${CONFIG.doctorBill}.`);
    } else {
      news.push("Your frozen burgers spoiled without a fridge — buy one to keep them.");
    }
    mealsStocked = 0; // nothing keeps without a fridge
  } else if (!fed && mealsStocked > 0) {
    mealsStocked -= 1;
    fed = true;
    news.push("You cooked a frozen Frosty Burger.");
  }

  // Sickness or hunger docks your time for the week — sickness supersedes hunger.
  let sick = false;
  let hungry = false;
  if (sickWeeks > 0) {
    time -= CONFIG.sicknessTimePenalty;
    sick = true;
    sickWeeks -= 1; // a week of recovery
    news.push(`🤒 You're under the weather — lost ${CONFIG.sicknessTimePenalty} time this week.`);
  } else if (!fed) {
    hungry = true;
    time -= CONFIG.hungerTimePenalty;
    news.push("You have to eat! Lost 5 time this week.");
  }

  // Lottery: a ticket bought last turn is drawn now.
  let lotteryTicket = you.lotteryTicket;
  if (lotteryTicket) {
    const draw = makeRng(state.seed + state.week * 97 + 7);
    if (draw() < CONFIG.lotteryWinChance) {
      const prize = (1 + Math.floor(draw() * (CONFIG.lotteryMaxPrize / 100))) * 100;
      cash += prize;
      news.push(`🎉 You won $${prize} in the lottery!`);
    } else {
      news.push("Your lottery ticket didn't win. Maybe next week.");
    }
    lotteryTicket = false; // consumed at the draw
  }

  // You have to show up for work.
  const skippedWork = isEmployed(you) && !you.workedThisWeek;
  const weeksSinceWorked = skippedWork ? you.weeksSinceWorked + 1 : 0;
  const fired = shouldBeFired({ ...you, weeksSinceWorked });
  if (fired) news.push("Fired — you stopped showing up. Find a new job at the Employment Office.");
  else if (skippedWork) news.push("Your boss noticed you skipped work this week.");

  // Clothes wear out; in rags you can't work or study until you buy new ones.
  const clothingWear = you.clothingWear + 1;
  if (clothingWear >= CONFIG.clothingLastsWeeks) {
    news.push("Your clothes are worn out — buy new ones or you can't work or study.");
  } else if (clothingWear === CONFIG.clothingLastsWeeks - 1) {
    news.push("Your clothes are getting threadbare — replace them soon.");
  }

  // Rent hangs over you. The overdue clock advances only on a week you paid
  // NOTHING — make any payment and it resets, like work attendance. Fall too
  // far behind (zero payments) and you're evicted — game over.
  const weeksRentOverdue = you.rentDue > 0 && !you.paidRentThisWeek ? you.weeksRentOverdue + 1 : 0;
  const evicted = shouldBeEvicted({ ...you, weeksRentOverdue });
  if (evicted) {
    news.push(`Evicted! You fell too far behind on rent ($${you.rentDue}). Game over.`);
  } else if (you.rentDue > 0) {
    news.push(weeksRentOverdue >= CONFIG.evictAfterWeeks
      ? `FINAL NOTICE: rent $${you.rentDue} overdue — pay now or you're evicted next week!`
      : `Rent due: $${you.rentDue} — pay it at the Rent Office.`);
  }

  // Ready to play: home, fresh time, flags reset for the new week.
  const home = world.buildings.find((b) => b.id === you.housingId)?.node ?? you.position;
  const ready: Player = {
    ...you,
    position: home,
    cash,
    debt,
    timeLeft: time,
    hungry,
    sick,
    sickWeeks,
    ateThisWeek: false,
    workedThisWeek: false,
    mealsStocked,
    lotteryTicket,
    jobId: fired ? null : you.jobId,
    weeksSinceWorked: fired ? 0 : weeksSinceWorked,
    weeksRentOverdue,
    paidRentThisWeek: false, // fresh week, no payment yet
    clothingWear,
  };

  return addNews(setPlayer({ ...state, phase: evicted ? "lost" : "playing" }, ready), news);
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
      // No news line here — startTurn reminds you of the balance every week
      // until it's paid (this month's charge included).
    }
  }

  // Promotion, then happiness decay.
  const afterPromo = checkPromotion(afterRent);
  if (afterPromo.careerLevel > afterRent.careerLevel) news.push(`Promoted to career level ${afterPromo.careerLevel}!`);
  const afterDecay = decayHappiness(afterPromo);
  const happinessLost = afterPromo.happiness - afterDecay.happiness;
  if (happinessLost > 0) news.push(`The weekly grind wore you down — happiness −${happinessLost}. Buy something you enjoy to lift it.`);

  // High Security living: a little weekly happiness for the premium rent.
  const afterPerk = afterDecay.housingId === "highsec"
    ? { ...afterDecay, happiness: afterDecay.happiness + CONFIG.highSecHappiness }
    : afterDecay;
  if (afterPerk.happiness > afterDecay.happiness) {
    news.push(`High Security living lifts your spirits — happiness +${CONFIG.highSecHappiness}.`);
  }

  // The weekend: a seeded chance something happens (mugger, concert, windfall…).
  const event = rollWeekendEvent(afterPerk, state.seed, state.week);
  const afterEvent = event ? event.player : afterPerk;
  if (event) news.push(event.news);

  // An economic crisis (index at an extreme) can lay you off or cut your pay.
  const crisis = rollCrisis(afterEvent, economyIndex, state.seed, state.week);
  const afterCrisis = crisis ? crisis.player : afterEvent;
  if (crisis) news.push(crisis.news);

  const settled = addNews(
    { ...setPlayer(state, afterCrisis), week: state.week + 1, economyIndex },
    news,
  );

  // Goals met → you win; otherwise roll into the next turn's preflight.
  if (hasWon(settled, state.current)) return { ...settled, phase: "won" };
  const next = gameLoop({ ...settled, phase: "startTurn" }, world);

  // Make sure the new week's briefing isn't blank (settlement + preflight may
  // both have been quiet).
  const hasBriefing = next.log.some((e) => e.week === next.week);
  return hasBriefing ? next : addNews(next, ["A quiet week — nothing in the news."]);
}
