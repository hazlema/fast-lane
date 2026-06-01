// game/engine/events.ts
//
// Weekend events (Mechanic 9). At each week-end the loop rolls a seeded chance
// that something happens to you over the weekend — a mugging, a concert, a
// lucky find. Events are a small data table; add one by appending to
// WEEKEND_EVENTS, no loop changes. Pure given (player, seed, week).
import type { Player } from "./state";
import { CONFIG } from "../data/config";
import { makeRng } from "./rng";
import { isMuggerSafe } from "./checks";

export interface WeekendEvent {
  id: string;
  weight: number;                    // relative odds when an event fires
  eligible: (p: Player) => boolean;  // can this happen to this player?
  apply: (p: Player, rng: () => number) => { player: Player; news: string };
}

// News lines lead with a distinctive emoji so the UI can pick a feedback tone.
export const WEEKEND_EVENTS: WeekendEvent[] = [
  {
    id: "mugger",
    weight: 2,
    eligible: (p) => p.cash > 0 && !isMuggerSafe(p),
    apply: (p) => ({
      player: { ...p, cash: 0 },
      news: `🚨 A mugger cleaned you out — lost $${p.cash}! Keep your cash in the bank.`,
    }),
  },
  {
    id: "concert",
    weight: 2,
    eligible: () => true,
    apply: (p) => ({
      player: { ...p, happiness: p.happiness + CONFIG.concertHappiness },
      news: `🎵 You caught a great concert — happiness +${CONFIG.concertHappiness}.`,
    }),
  },
  {
    id: "windfall",
    weight: 1,
    eligible: () => true,
    apply: (p, rng) => {
      const amt = CONFIG.windfallMin + Math.floor(rng() * (CONFIG.windfallMax - CONFIG.windfallMin + 1));
      return { player: { ...p, cash: p.cash + amt }, news: `💰 Lucky you — found $${amt}.` };
    },
  },
];

// Roll the weekend: the chosen event's effect + news, or null if a quiet weekend.
export function rollWeekendEvent(player: Player, seed: number, week: number): { player: Player; news: string } | null {
  const rng = makeRng(seed + week * 131 + 17);
  if (rng() >= CONFIG.weekendEventChance) return null;
  const eligible = WEEKEND_EVENTS.filter((e) => e.eligible(player));
  if (eligible.length === 0) return null;
  const total = eligible.reduce((s, e) => s + e.weight, 0);
  let pick = rng() * total;
  for (const e of eligible) {
    pick -= e.weight;
    if (pick < 0) return e.apply(player, rng);
  }
  return eligible[eligible.length - 1].apply(player, rng);
}
