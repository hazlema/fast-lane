// game/engine/tests/loop.test.ts
import { test, expect } from "bun:test";
import { newGame, gameLoop, startTurn, endTurn } from "../loop";
import { createGame } from "../state";
import { TEST_WORLD } from "../../data/world";
import { CONFIG } from "../../data/config";

// A game already in the "playing" phase (goals set), with optional overrides.
function playing(over: Partial<ReturnType<typeof createGame>["players"][number]> = {}, week = 1) {
  let g = createGame({ playerName: "Al", startNode: "n0", seed: 1 });
  g = gameLoop({ ...g, phase: "startTurn" }, TEST_WORLD); // setup → playing
  return { ...g, week, players: [{ ...g.players[0], ...over }] };
}

test("newGame starts in setup; gameLoop is a no-op there", () => {
  const g = newGame({ playerName: "Al", startNode: "n0", seed: 1 });
  expect(g.phase).toBe("setup");
  expect(gameLoop(g, TEST_WORLD)).toBe(g); // setup passes straight through
});

test("startTurn refills time, resets flags, and lands in playing", () => {
  const g = createGame({ playerName: "Al", startNode: "n0", seed: 1 });
  const r = startTurn({ ...g, phase: "startTurn" }, TEST_WORLD);
  expect(r.phase).toBe("playing");
  expect(r.players[0].timeLeft).toBe(CONFIG.weeklyTimeBudget); // fed at game start → no dock
  expect(r.players[0].hungry).toBe(false);
  expect(r.players[0].ateThisWeek).toBe(false); // must eat this week
});

test("startTurn docks time and warns when you didn't eat", () => {
  const g = playing({ ateThisWeek: false });
  const r = startTurn({ ...g, phase: "startTurn" }, TEST_WORLD);
  expect(r.players[0].timeLeft).toBe(CONFIG.weeklyTimeBudget - CONFIG.hungerTimePenalty);
  expect(r.players[0].hungry).toBe(true);
  expect(r.log.some((e) => /eat/i.test(e.text))).toBe(true);
});

test("startTurn fires an employee who skipped too many weeks", () => {
  const g = playing({ jobId: "janitor", workedThisWeek: false, weeksSinceWorked: CONFIG.fireAfterWeeks });
  const r = startTurn({ ...g, phase: "startTurn" }, TEST_WORLD);
  expect(r.players[0].jobId).toBeNull();
  expect(r.log.some((e) => /fired/i.test(e.text))).toBe(true);
});

test("endTurn settles the week and rolls into the next playing turn", () => {
  const g = playing({ bank: 1000, happiness: 50, ateThisWeek: true });
  const r = endTurn({ ...g, phase: "endTurn" }, TEST_WORLD);
  expect(r.week).toBe(2);
  expect(r.phase).toBe("playing");        // cascaded endTurn → startTurn → playing
  expect(r.players[0].bank).toBe(1020);   // +2% interest
  expect(r.players[0].timeLeft).toBe(CONFIG.weeklyTimeBudget); // next week refilled
});

test("endTurn ends in 'won' when the goals are met (no cascade)", () => {
  const g = playing({ cash: 99999, happiness: 999, education: 999, careerLevel: 99 });
  const r = endTurn({ ...g, phase: "endTurn" }, TEST_WORLD);
  expect(r.phase).toBe("won");
});
