// game/engine/crisis.ts
//
// Economic crisis (Mechanic 10). When the economy index swings to an extreme
// (deep deflation or runaway inflation), the employed risk a layoff or a
// pay-cut. Seeded and deterministic per (seed, week). Pure.
//
// "Good jobs are rarely fired": the layoff chance is divided by the job tier
// (number of required degrees + 1), so a two-degree role is far safer than an
// entry job. A pay-cut is a demotion (careerLevel − 1).
import type { Player } from "./state";
import { CONFIG } from "../data/config";
import { makeRng } from "./rng";
import { isEmployed } from "./checks";
import { JOBS } from "../data/jobs";

export function inCrisis(economyIndex: number): boolean {
  return economyIndex <= CONFIG.crisisLowBand || economyIndex >= CONFIG.crisisHighBand;
}

export function rollCrisis(player: Player, economyIndex: number, seed: number, week: number): { player: Player; news: string } | null {
  if (!isEmployed(player) || !inCrisis(economyIndex)) return null;
  const tier = JOBS[player.jobId!]?.requiredDegrees.length ?? 0; // 0 entry … 2 top
  const layoffChance = CONFIG.crisisLayoffChance / (1 + tier);   // good jobs rarely fired
  const r = makeRng(seed + week * 251 + 53)();
  if (r < layoffChance) {
    return {
      player: { ...player, jobId: null, weeksSinceWorked: 0 },
      news: "🏭 Economic crisis — you were laid off! Find new work at the Employment Office.",
    };
  }
  if (r < layoffChance + CONFIG.crisisPayCutChance && player.careerLevel > 0) {
    return {
      player: { ...player, careerLevel: player.careerLevel - 1 },
      news: "📉 The downturn cost you a pay grade — career level −1.",
    };
  }
  return null; // weathered it
}
