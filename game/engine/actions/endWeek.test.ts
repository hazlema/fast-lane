// game/engine/actions/endWeek.test.ts
import { test, expect } from "bun:test";
import { applyAction } from "../reducer";
import { createGame } from "../state";
import { TEST_WORLD } from "../../data/world";
import { CONFIG } from "../../data/config";

function playing(over: Partial<ReturnType<typeof createGame>["players"][number]> = {}, week = 1) {
  let g = createGame({ playerName: "Al", startNode: "n0", seed: 1 });
  g = applyAction(g, { type: "setGoals", goals: g.goals }, TEST_WORLD).state;
  g = { ...g, week, players: [{ ...g.players[0], ...over }] };
  return g;
}

test("endWeek advances the week and refills time", () => {
  const g = playing({ timeLeft: 3, ateThisWeek: true }); // ate this week → no hunger penalty
  const r = applyAction(g, { type: "endWeek" }, TEST_WORLD);
  expect(r.ok).toBe(true);
  expect(r.state.week).toBe(2);
  expect(r.state.players[0].timeLeft).toBe(CONFIG.weeklyTimeBudget);
  expect(r.state.phase).toBe("playing");
});

test("not eating this week docks next week's time and logs it", () => {
  const g = playing({ ateThisWeek: false });
  const r = applyAction(g, { type: "endWeek" }, TEST_WORLD);
  expect(r.state.players[0].timeLeft).toBe(CONFIG.weeklyTimeBudget - CONFIG.hungerTimePenalty);
  expect(r.state.players[0].hungry).toBe(true);       // the new week is flagged hungry (HUD chip ⟺ penalty)
  expect(r.state.players[0].ateThisWeek).toBe(false); // reset — must eat again next week
  expect(r.state.log.some((e) => /hungry/i.test(e.text))).toBe(true);
});

test("eating this week means a full time budget next week", () => {
  const g = playing({ ateThisWeek: true });
  const r = applyAction(g, { type: "endWeek" }, TEST_WORLD);
  expect(r.state.players[0].timeLeft).toBe(CONFIG.weeklyTimeBudget);
  expect(r.state.players[0].hungry).toBe(false); // not penalized → no HUD chip
});

test("endWeek accrues interest and decays happiness (no weekly rent anymore)", () => {
  const g = playing({ cash: 500, bank: 1000, debt: 0, happiness: 50 });
  const r = applyAction(g, { type: "endWeek" }, TEST_WORLD);
  const p = r.state.players[0];
  expect(p.bank).toBe(1020);     // +2% of 1000
  expect(p.cash).toBe(500);      // rent is NOT auto-deducted weekly anymore
  expect(p.happiness).toBe(45);  // -5 decay
});

test("endWeek re-rolls the economy index", () => {
  const g = playing();
  const r = applyAction(g, { type: "endWeek" }, TEST_WORLD);
  expect(typeof r.state.economyIndex).toBe("number");
  expect(r.state.economyIndex).toBeGreaterThanOrEqual(CONFIG.indexFloor);
  expect(r.state.economyIndex).toBeLessThanOrEqual(CONFIG.indexCeil);
});

test("monthly rent accrues to rentDue at a month boundary when housed", () => {
  const g = playing({ housingId: "lowcost", rentDue: 0 }, 4); // week 4 = month end
  const r = applyAction(g, { type: "endWeek" }, TEST_WORLD);
  expect(r.state.players[0].rentDue).toBeGreaterThan(0); // ~ round(40 × index)
  expect(r.state.log.some((e) => e.text.includes("Rent"))).toBe(true);
});

test("no rent accrues mid-month", () => {
  const g = playing({ housingId: "lowcost", rentDue: 0 }, 1); // week 1, not month end
  const r = applyAction(g, { type: "endWeek" }, TEST_WORLD);
  expect(r.state.players[0].rentDue).toBe(0);
});

test("endWeek sets phase to won when all goals are met", () => {
  const g = playing({ cash: 99999, happiness: 999, education: 999, careerLevel: 99 });
  const r = applyAction(g, { type: "endWeek" }, TEST_WORLD);
  expect(r.state.phase).toBe("won");
});

test("endWeek is rejected when not playing", () => {
  const g = createGame({ playerName: "Al", startNode: "n0", seed: 1 }); // setup phase
  const r = applyAction(g, { type: "endWeek" }, TEST_WORLD);
  expect(r.ok).toBe(false);
});
