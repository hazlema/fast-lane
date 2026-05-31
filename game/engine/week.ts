// game/engine/week.ts
//
// The turn boundary, in one place. `startWeek` answers a single question —
// "what does the player start a week with?" — as a readable checklist of
// predicates. Both entry points call it: setGoals (week 1) and endWeek (every
// rollover after). Week 1 isn't a special case; it's the same checklist with
// nothing to penalize.
//
// New start-of-week mechanics land HERE as one more line, never as an inline
// branch in endWeek:
//   if (!isClothed(prev)) { timeUnits -= …; events.push("You're in rags — …"); }
//   if (isSick(prev))     { timeUnits -= …; events.push("You're ill — …"); }
import type { Player } from "./state";
import type { World } from "./world";
import { CONFIG } from "../data/config";
import { isEmployed, isFed, shouldBeFired } from "./checks";

export interface WeekStart {
  player: Player;    // the player ready to act in the new week
  events: string[];  // news lines describing what the new week opened with
}

/**
 * Begin a fresh week for `prev` (the player as the *previous* week left them):
 * send them home, refill their time, apply the start-of-week penalties the
 * previous week earned, and reset the weekly flags.
 */
export function startWeek(prev: Player, world: World): WeekStart {
  const events: string[] = [];
  const homeNode = world.buildings.find((b) => b.id === prev.housingId)?.node ?? prev.position;

  let timeUnits = CONFIG.weeklyTimeBudget;

  // Hunger: didn't eat last week → docked, and flagged for the HUD chip.
  const fed = isFed(prev);
  if (!fed) {
    timeUnits -= CONFIG.hungerTimePenalty;
    events.push(`You went hungry — lost ${CONFIG.hungerTimePenalty} time this week. Eat next time!`);
  }

  // Attendance: an employed worker who skipped last week accrues an absent
  // week; enough in a row → fired.
  const absent = isEmployed(prev) && !prev.workedThisWeek;
  const weeksSinceWorked = absent ? prev.weeksSinceWorked + 1 : 0;
  const fired = shouldBeFired({ ...prev, weeksSinceWorked });
  if (fired) events.push("Fired — you stopped showing up. Find a new job at the Employment Office.");
  else if (absent) events.push("Your boss noticed you skipped work this week.");

  const player: Player = {
    ...prev,
    position: homeNode,
    timeLeft: timeUnits,
    hungry: !fed,                                   // HUD chip ⟺ a docked week
    ateThisWeek: false,                             // must eat again this week
    workedThisWeek: false,                          // new week — show up again
    jobId: fired ? null : prev.jobId,               // skipped too long → let go
    weeksSinceWorked: fired ? 0 : weeksSinceWorked, // fired → clean slate as unemployed
  };
  return { player, events };
}
