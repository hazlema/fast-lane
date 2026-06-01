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
import type { Item } from "../data/items";
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

/** Are you sick this week? (food poisoning from spoiled groceries — docks time) */
export const isSick = (p: Player): boolean => p.sickWeeks > 0;

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

/** Living in High Security shields un-banked cash from the (6d) mugger event. */
export const isMuggerSafe = (p: Player): boolean => p.housingId === "highsec";

/** Own a refrigerator? Lets frozen groceries keep — the (6d) spoilage hook. */
export const ownsFridge = (p: Player): boolean => p.inventory.includes("fridge");

/** Own a computer? Earns a little passive weekly income (a home business). */
export const ownsComputer = (p: Player): boolean => p.inventory.includes("computer");

/** Own a Tesla? Free travel + weekly robotaxi income. */
export const ownsCar = (p: Player): boolean => p.inventory.includes("tesla");

/** Can the dealership finance you a car? Employed, in a job that pays well enough. */
export const canFinanceCar = (p: Player, job: Job | null | undefined): boolean =>
  isEmployed(p) && !!job && job.wage >= CONFIG.carJobWageMin;

/** Will the pawn shop buy this back? Durable goods only — not food/tickets/frozen packs. */
export const isPawnable = (item: Item): boolean => !item.food && !item.lottery && item.meals === 0;

// One-per-customer durables: appliances you own, not repeatable buys (newspaper,
// clothes, food). Buying a second is rejected (see buy.ts).
const DURABLE_ITEMS = new Set(["tv", "tv_used", "stereo", "fridge", "computer", "tesla"]);

/** Is this a one-only durable good (an appliance you can't sensibly own twice)? */
export const isDurable = (item: Item): boolean => DURABLE_ITEMS.has(item.id);

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
