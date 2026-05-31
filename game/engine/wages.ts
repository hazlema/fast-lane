// game/engine/wages.ts
import type { Job } from "../data/jobs";
import { CONFIG } from "../data/config";

// Pay for one shift, boosted by career level.
export function wageFor(job: Job, careerLevel: number): number {
  return Math.round(job.wage * (1 + careerLevel * CONFIG.careerWageBonus));
}
