// game/engine/checks.ts
//
// Small, pure predicates over player/job state. Compound game rules are built
// by COMBINING these, never by re-deriving conditions inline at each call site.
// One rule → one function here → every screen and action agrees on it.
//
// This is the seam the rest of the game grows on. As mechanics land, the new
// rule is a predicate here and a line at the call site — e.g. clothing wear-out
// becomes `isClothed(p)`, sickness `isWell(p)`, attendance `hasGoodWorkHistory(p)`
// (and "Rejected: poor work history" + getting fired are just those predicates
// read in applyForJob / endWeek).
import type { Player } from "./state";
import type { Job } from "../data/jobs";
import type { CourseId } from "../data/courses";
import { CONFIG } from "../data/config";
import { makeRng } from "./rng";

// --- Status --------------------------------------------------------------

/** Do you currently hold a job? */
export const isEmployed = (p: Player): boolean => p.jobId !== null;

/** Have you eaten this week? (else next week is docked — see endWeek) */
export const isFed = (p: Player): boolean => p.ateThisWeek;

/** Are your clothes still wearable? (past CONFIG.clothingLastsWeeks → in rags) */
export const isClothed = (p: Player): boolean => p.clothingWear < CONFIG.clothingLastsWeeks;

/** Can you cover a cash cost right now? */
export const canAfford = (p: Player, cost: number): boolean => p.cash >= cost;

/** Recent attendance still acceptable? (too many missed weeks → a "poor" record) */
export const hasGoodWorkHistory = (p: Player): boolean => p.weeksSinceWorked <= CONFIG.maxWeeksAbsent;

/** Has an employed worker skipped enough weeks in a row to be fired? */
export const shouldBeFired = (p: Player): boolean =>
  isEmployed(p) && p.weeksSinceWorked > CONFIG.fireAfterWeeks;

/** Has rent gone unpaid long enough to be evicted (game over)? */
export const shouldBeEvicted = (p: Player): boolean =>
  p.weeksRentOverdue > CONFIG.evictAfterWeeks;

// --- Hiring --------------------------------------------------------------

/** Degrees the job demands that you haven't earned yet. */
export const missingDegrees = (p: Player, job: Job): CourseId[] =>
  job.requiredDegrees.filter((d) => !p.completedCourses.includes(d));

/** Do you clear every hiring bar: the degree(s), the experience, the dependability? */
export const isQualifiedFor = (p: Player, job: Job): boolean =>
  missingDegrees(p, job).length === 0 &&
  p.experience >= job.requiredExperience &&
  p.dependability >= job.requiredDependability;

// Stable per-job offset so each job rolls its own (seed+week)-based opening.
function hashJob(id: string): number {
  let h = 0;
  for (const ch of id) h = (h + ch.charCodeAt(0)) | 0;
  return h;
}

/**
 * Is there an opening this week? Entry jobs (no degree) always hire; specialised
 * roles roll a deterministic (seed+week+job) chance. Pure given its inputs.
 */
export function hasOpening(job: Job, seed: number, week: number): boolean {
  if (job.requiredDegrees.length === 0) return true;
  return makeRng(seed + week * 31 + hashJob(job.id))() >= CONFIG.noOpeningChance;
}
