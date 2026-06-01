// game/engine/checks.test.ts
import { test, expect } from "bun:test";
import { createGame } from "../state";
import { isEmployed, isFed, canAfford, missingDegrees, isQualifiedFor, hasOpening, hasGoodWorkHistory, shouldBeFired, isMuggerSafe, ownsFridge, isPawnable } from "../checks";
import { JOBS } from "../../data/jobs";
import { ITEMS } from "../../data/items";
import { CONFIG } from "../../data/config";

const player = (over: Partial<ReturnType<typeof createGame>["players"][number]> = {}) => ({
  ...createGame({ playerName: "Al", startNode: "n0", seed: 1 }).players[0],
  ...over,
});

test("isEmployed reflects whether a job is held", () => {
  expect(isEmployed(player({ jobId: null }))).toBe(false);
  expect(isEmployed(player({ jobId: "cook" }))).toBe(true);
});

test("isFed mirrors ateThisWeek", () => {
  expect(isFed(player({ ateThisWeek: true }))).toBe(true);
  expect(isFed(player({ ateThisWeek: false }))).toBe(false);
});

test("canAfford compares cash to a cost", () => {
  expect(canAfford(player({ cash: 100 }), 100)).toBe(true);
  expect(canAfford(player({ cash: 99 }), 100)).toBe(false);
});

test("isMuggerSafe only in High Security (6d mugger hook)", () => {
  expect(isMuggerSafe(player({ housingId: "highsec" }))).toBe(true);
  expect(isMuggerSafe(player({ housingId: "lowcost" }))).toBe(false);
  expect(isMuggerSafe(player({ housingId: null }))).toBe(false);
});

test("ownsFridge reflects fridge in inventory (6d spoilage hook)", () => {
  expect(ownsFridge(player({ inventory: ["fridge"] }))).toBe(true);
  expect(ownsFridge(player({ inventory: ["tv"] }))).toBe(false);
});

test("isPawnable accepts durables, rejects food/tickets/frozen packs", () => {
  expect(isPawnable(ITEMS.tv)).toBe(true);
  expect(isPawnable(ITEMS.suit)).toBe(true);
  expect(isPawnable(ITEMS.burger)).toBe(false);   // food
  expect(isPawnable(ITEMS.lottery)).toBe(false);  // ticket
  expect(isPawnable(ITEMS.burger8)).toBe(false);  // frozen meals
});

test("missingDegrees lists only the degrees not yet earned", () => {
  expect(missingDegrees(player({ completedCourses: [] }), JOBS.clerk)).toEqual(["juniorcollege"]);
  expect(missingDegrees(player({ completedCourses: ["juniorcollege"] }), JOBS.clerk)).toEqual([]);
});

test("isQualifiedFor needs the degree, the experience, and the dependability", () => {
  // teller: juniorcollege + 10 experience + 10 dependability
  expect(isQualifiedFor(player({ completedCourses: ["juniorcollege"], experience: 10, dependability: 10 }), JOBS.teller)).toBe(true);
  expect(isQualifiedFor(player({ completedCourses: ["juniorcollege"], experience: 9, dependability: 10 }), JOBS.teller)).toBe(false);
  expect(isQualifiedFor(player({ completedCourses: [], experience: 99, dependability: 99 }), JOBS.teller)).toBe(false);
});

test("hasGoodWorkHistory turns poor past the allowed absence", () => {
  expect(hasGoodWorkHistory(player({ weeksSinceWorked: CONFIG.maxWeeksAbsent }))).toBe(true);
  expect(hasGoodWorkHistory(player({ weeksSinceWorked: CONFIG.maxWeeksAbsent + 1 }))).toBe(false);
});

test("shouldBeFired only applies to the employed and only past the fire threshold", () => {
  expect(shouldBeFired(player({ jobId: "cook", weeksSinceWorked: CONFIG.fireAfterWeeks }))).toBe(false);
  expect(shouldBeFired(player({ jobId: "cook", weeksSinceWorked: CONFIG.fireAfterWeeks + 1 }))).toBe(true);
  expect(shouldBeFired(player({ jobId: null, weeksSinceWorked: 99 }))).toBe(false); // unemployed can't be fired
});

test("hasOpening is always true for entry jobs, deterministic for gated ones", () => {
  expect(hasOpening(JOBS.cook, 1, 1)).toBe(true); // no degree → always hiring
  // gated job: same (seed, week) → same answer every time
  expect(hasOpening(JOBS.teller, 42, 3)).toBe(hasOpening(JOBS.teller, 42, 3));
});
