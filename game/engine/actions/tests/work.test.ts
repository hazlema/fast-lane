// game/engine/actions/work.test.ts
import { test, expect } from "bun:test";
import { applyAction } from "../../reducer";
import { createGame } from "../../state";
import { TEST_WORLD } from "../../../data/world";

// Start a playing game with the player employed as janitor (works at "factory", node n0).
function employedAtFactory() {
  let g = createGame({ playerName: "Al", startNode: "n0", seed: 1 });
  g = applyAction(g, { type: "setGoals", goals: g.goals }, TEST_WORLD).state;
  g = { ...g, players: [{ ...g.players[0], jobId: "janitor", position: "n0" }] };
  return g;
}

test("work pays wage, costs time, adds experience", () => {
  const g = employedAtFactory();
  const before = g.players[0];
  const r = applyAction(g, { type: "work" }, TEST_WORLD);
  expect(r.ok).toBe(true);
  const p = r.state.players[0];
  expect(p.cash).toBe(before.cash + TEST_WORLD.jobs.janitor.wage); // careerLevel 0 → base wage
  expect(p.timeLeft).toBe(before.timeLeft - TEST_WORLD.jobs.janitor.timeCost);
  expect(p.experience).toBe(before.experience + 1);
});

test("work is rejected with no job", () => {
  let g = createGame({ playerName: "Al", startNode: "n0", seed: 1 });
  g = applyAction(g, { type: "setGoals", goals: g.goals }, TEST_WORLD).state;
  const r = applyAction(g, { type: "work" }, TEST_WORLD);
  expect(r.ok).toBe(false);
  expect(r.reason).toMatch(/job/i);
});

test("work is rejected when not at the job's building", () => {
  let g = employedAtFactory();
  g = { ...g, players: [{ ...g.players[0], position: "n3" }] }; // university, not factory
  const r = applyAction(g, { type: "work" }, TEST_WORLD);
  expect(r.ok).toBe(false);
  expect(r.reason).toMatch(/workplace|building|there/i);
});

test("work is rejected without enough time", () => {
  let g = employedAtFactory();
  g = { ...g, players: [{ ...g.players[0], timeLeft: 0 }] }; // a shift costs 1 unit
  const r = applyAction(g, { type: "work" }, TEST_WORLD);
  expect(r.ok).toBe(false);
  expect(r.reason).toMatch(/time/i);
});
