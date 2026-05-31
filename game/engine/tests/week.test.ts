// game/engine/tests/week.test.ts
import { test, expect } from "bun:test";
import { startWeek } from "../week";
import { createGame } from "../state";
import { TEST_WORLD } from "../../data/world";
import { CONFIG } from "../../data/config";

const player = (over: Partial<ReturnType<typeof createGame>["players"][number]> = {}) => ({
  ...createGame({ playerName: "Al", startNode: "n0", seed: 1 }).players[0],
  ...over,
});

test("a fed, unemployed player starts with a full budget and no news", () => {
  const { player: p, events } = startWeek(player({ ateThisWeek: true, jobId: null }), TEST_WORLD);
  expect(p.timeLeft).toBe(CONFIG.weeklyTimeBudget);
  expect(p.hungry).toBe(false);
  expect(p.ateThisWeek).toBe(false);   // reset — must eat this week
  expect(p.workedThisWeek).toBe(false);
  expect(events).toEqual([]);
});

test("not eating last week docks time, flags hungry, and announces it", () => {
  const { player: p, events } = startWeek(player({ ateThisWeek: false }), TEST_WORLD);
  expect(p.timeLeft).toBe(CONFIG.weeklyTimeBudget - CONFIG.hungerTimePenalty);
  expect(p.hungry).toBe(true);
  expect(events.some((e) => /hungry/i.test(e))).toBe(true);
});

test("an employed worker who skipped enough weeks is fired", () => {
  const { player: p, events } = startWeek(
    player({ jobId: "janitor", workedThisWeek: false, weeksSinceWorked: CONFIG.fireAfterWeeks }),
    TEST_WORLD,
  );
  expect(p.jobId).toBeNull();
  expect(p.weeksSinceWorked).toBe(0); // clean slate as unemployed
  expect(events.some((e) => /fired/i.test(e))).toBe(true);
});

test("working last week keeps the job and resets attendance", () => {
  const { player: p, events } = startWeek(
    player({ jobId: "janitor", workedThisWeek: true, weeksSinceWorked: CONFIG.fireAfterWeeks }),
    TEST_WORLD,
  );
  expect(p.jobId).toBe("janitor");
  expect(p.weeksSinceWorked).toBe(0);
  expect(events.some((e) => /fired|skipped/i.test(e))).toBe(false);
});

test("the player is sent home (falls back to current node when housing is unresolved)", () => {
  const { player: p } = startWeek(player({ position: "n2", housingId: null }), TEST_WORLD);
  expect(p.position).toBe("n2");
});
