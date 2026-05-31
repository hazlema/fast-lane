// game/engine/winCheck.test.ts
import { test, expect } from "bun:test";
import { wealthOf, statValue, hasWon } from "./winCheck";
import { createGame } from "./state";

function gameWith(overrides: Partial<ReturnType<typeof createGame>["players"][number]>) {
  const g = createGame({ playerName: "Al", startNode: "n0", seed: 1 });
  g.goals = { wealth: 1000, happiness: 50, education: 50, career: 3 };
  g.players[0] = { ...g.players[0], ...overrides };
  return g;
}

test("wealthOf is cash + bank - debt", () => {
  const g = gameWith({ cash: 500, bank: 700, debt: 200 });
  expect(wealthOf(g.players[0])).toBe(1000);
});

test("statValue maps each stat correctly", () => {
  const g = gameWith({ cash: 1000, bank: 0, debt: 0, happiness: 12, education: 34, careerLevel: 2 });
  const p = g.players[0];
  expect(statValue(p, "wealth")).toBe(1000);
  expect(statValue(p, "happiness")).toBe(12);
  expect(statValue(p, "education")).toBe(34);
  expect(statValue(p, "career")).toBe(2);
});

test("hasWon is false when any goal is unmet", () => {
  const g = gameWith({ cash: 1000, bank: 0, debt: 0, happiness: 50, education: 50, careerLevel: 2 });
  expect(hasWon(g, 0)).toBe(false); // career 2 < 3
});

test("hasWon is true only when all goals are met or exceeded", () => {
  const g = gameWith({ cash: 1200, bank: 0, debt: 0, happiness: 60, education: 50, careerLevel: 3 });
  expect(hasWon(g, 0)).toBe(true);
});
