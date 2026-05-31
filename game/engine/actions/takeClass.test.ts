// game/engine/actions/takeClass.test.ts
import { test, expect } from "bun:test";
import { applyAction } from "../reducer";
import { createGame } from "../state";
import { WORLD } from "../../data/world";

function atUniversity(cash = 1000) {
  let g = createGame({ playerName: "Al", startNode: "n3", seed: 1 }); // university = n3
  g = applyAction(g, { type: "setGoals", goals: g.goals }, WORLD).state;
  g = { ...g, players: [{ ...g.players[0], cash }] };
  return g;
}

test("taking a class raises education, costs cash and time", () => {
  const g = atUniversity();
  const before = g.players[0];
  const c = WORLD.courses.basics;
  const r = applyAction(g, { type: "takeClass", course: "basics" }, WORLD);
  expect(r.ok).toBe(true);
  const p = r.state.players[0];
  expect(p.education).toBe(before.education + c.educationGain);
  expect(p.cash).toBe(before.cash - c.cost);
  expect(p.timeLeft).toBe(before.timeLeft - c.timeCost);
});

test("taking a class is rejected without enough cash", () => {
  const g = atUniversity(10); // engineering costs 250
  const r = applyAction(g, { type: "takeClass", course: "engineering" }, WORLD);
  expect(r.ok).toBe(false);
  expect(r.reason).toMatch(/cash|afford|money/i);
});

test("taking a class is rejected away from a university", () => {
  let g = atUniversity();
  g = { ...g, players: [{ ...g.players[0], position: "n4" }] }; // bank
  const r = applyAction(g, { type: "takeClass", course: "basics" }, WORLD);
  expect(r.ok).toBe(false);
  expect(r.reason).toMatch(/education|university|here/i);
});
