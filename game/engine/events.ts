// game/engine/events.ts
//
// Weekend events (Mechanic 9). At each week-end the loop checks each event in
// turn: if it's eligible for you this week, it rolls its OWN per-week chance.
// The first one to hit fires (at most one event a weekend). Events are a small
// data table — add one by appending to WEEKEND_EVENTS, no loop changes. Pure
// given (player, seed, week).
import type { Player } from "./state";
import { CONFIG } from "../data/config";
import { makeRng } from "./rng";
import { isMuggerSafe } from "./checks";

export interface WeekendEvent {
  id: string;
  chance: number;                                  // independent per-week probability
  eligible: (p: Player, week: number) => boolean;  // can this happen to you this week?
  apply: (p: Player, rng: () => number) => { player: Player; news: string };
}

// News lines lead with a distinctive emoji so the UI can pick a feedback tone.
// Order matters only when two events could fire the same weekend — earlier wins;
// the rare, dangerous mugger goes first so it gets first dibs.
export const WEEKEND_EVENTS: WeekendEvent[] = [
  {
    id: "mugger",
    chance: CONFIG.muggerChance,
    eligible: (p, week) => week > CONFIG.muggerStartsAfterWeek && p.cash > 0 && !isMuggerSafe(p),
    apply: (p) => ({
      player: { ...p, cash: 0 },
      news: `🚨 A mugger cleaned you out — lost $${p.cash}! Keep your cash in the bank.`,
    }),
  },
  {
    id: "concert",
    chance: CONFIG.concertChance,
    eligible: () => true,
    apply: (p) => ({
      player: { ...p, happiness: p.happiness + CONFIG.concertHappiness },
      news: `🎵 You caught a great concert — happiness +${CONFIG.concertHappiness}.`,
    }),
  },
  {
    id: "windfall",
    chance: CONFIG.windfallChance,
    eligible: () => true,
    apply: (p, rng) => {
      const amt = CONFIG.windfallMin + Math.floor(rng() * (CONFIG.windfallMax - CONFIG.windfallMin + 1));
      return { player: { ...p, cash: p.cash + amt }, news: `💰 Lucky you — found $${amt}.` };
    },
  },
];

// Roll the weekend: the first eligible event to hit its chance, or null if quiet.
export function rollWeekendEvent(player: Player, seed: number, week: number): { player: Player; news: string } | null {
  const rng = makeRng(seed + week * 131 + 17);
  for (const e of WEEKEND_EVENTS) {
    if (e.eligible(player, week) && rng() < e.chance) return e.apply(player, rng);
  }
  return null;
}
