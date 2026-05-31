// game/engine/actions/endWeek.test.ts
import { test, expect } from "bun:test";
import { applyAction } from "../reducer";
import { createGame } from "../state";
import { TEST_WORLD } from "../../data/world";
import { CONFIG } from "../../data/config";

function playing(over: Partial<ReturnType<typeof createGame>["players"][number]> = {}) {
  let g = createGame({ playerName: "Al", startNode: "n0", seed: 1 });
  g = applyAction(g, { type: "setGoals", goals: g.goals }, TEST_WORLD).state;
  g = { ...g, players: [{ ...g.players[0], ...over }] };
  return g;
}

test("endWeek advances the week and refills time", () => {
  const g = playing({ timeLeft: 3 });
  const r = applyAction(g, { type: "endWeek" }, TEST_WORLD);
  expect(r.ok).toBe(true);
  expect(r.state.week).toBe(2);
  expect(r.state.players[0].timeLeft).toBe(CONFIG.weeklyTimeBudget);
  expect(r.state.phase).toBe("playing");
});

test("endWeek accrues interest, charges rent, and decays happiness", () => {
  const g = playing({ cash: 500, bank: 1000, debt: 0, weeklyRent: 40, happiness: 50 });
  const r = applyAction(g, { type: "endWeek" }, TEST_WORLD);
  const p = r.state.players[0];
  expect(p.bank).toBe(1020);          // +2% of 1000
  expect(p.cash).toBe(460);           // 500 - 40 rent
  expect(p.happiness).toBe(45);       // -5 decay
});

test("endWeek logs an entry for the week", () => {
  const g = playing();
  const r = applyAction(g, { type: "endWeek" }, TEST_WORLD);
  expect(r.state.log.length).toBe(1);
  expect(r.state.log[0].week).toBe(1);
});

test("endWeek sets phase to won when all goals are met", () => {
  const g = playing({
    cash: 99999, happiness: 999, education: 999, careerLevel: 99,
  });
  const r = applyAction(g, { type: "endWeek" }, TEST_WORLD);
  expect(r.state.phase).toBe("won");
});

test("endWeek is rejected when not playing", () => {
  const g = createGame({ playerName: "Al", startNode: "n0", seed: 1 }); // setup phase
  const r = applyAction(g, { type: "endWeek" }, TEST_WORLD);
  expect(r.ok).toBe(false);
});
