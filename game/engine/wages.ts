// game/engine/wages.ts
import type { Job } from "../data/jobs";
import { CONFIG } from "../data/config";

// Pay for one shift: boosted by career level, scaled INVERSELY by the economy
// index (inflation up → take-home down). economyIndex defaults to 1 (no effect).
export function wageFor(job: Job, careerLevel: number, economyIndex = 1): number {
  const base = job.wage * (1 + careerLevel * CONFIG.careerWageBonus);
  return Math.round(base / economyIndex);
}
