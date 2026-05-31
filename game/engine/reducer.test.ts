// game/engine/reducer.test.ts
import { test, expect } from "bun:test";
import { applyAction } from "./reducer";
import { createGame } from "./state";
import { TEST_WORLD } from "../data/world";
import { CONFIG } from "../data/config";

function newGame() {
  return createGame({ playerName: "Al", startNode: "n0", seed: 1 });
}

test("setGoals records goals and starts the week (playing, full time)", () => {
  const g = newGame();
  const goals = { wealth: 2000, happiness: 40, education: 30, career: 2 };
  const r = applyAction(g, { type: "setGoals", goals }, TEST_WORLD);
  expect(r.ok).toBe(true);
  expect(r.state.phase).toBe("playing");
  expect(r.state.goals).toEqual(goals);
  expect(r.state.players[0].timeLeft).toBe(CONFIG.weeklyTimeBudget);
});

test("setGoals is rejected once already playing", () => {
  const g = newGame();
  const started = applyAction(g, { type: "setGoals", goals: g.goals }, TEST_WORLD).state;
  const r = applyAction(started, { type: "setGoals", goals: g.goals }, TEST_WORLD);
  expect(r.ok).toBe(false);
  expect(r.reason).toMatch(/setup/i);
  expect(r.state).toBe(started); // unchanged reference
});

test("moveTo deducts travel time and updates position", () => {
  const g = applyAction(newGame(), { type: "setGoals", goals: newGame().goals }, TEST_WORLD).state;
  const r = applyAction(g, { type: "moveTo", node: "n3" }, TEST_WORLD); // 3 hops × 1 = 3
  expect(r.ok).toBe(true);
  expect(r.state.players[0].position).toBe("n3");
  expect(r.state.players[0].timeLeft).toBe(CONFIG.weeklyTimeBudget - 3);
});

test("moveTo is rejected when not enough time remains", () => {
  let g = applyAction(newGame(), { type: "setGoals", goals: newGame().goals }, TEST_WORLD).state;
  // Drain time down to 2 by editing a copy (engine-internal setup for the test).
  g = { ...g, players: [{ ...g.players[0], timeLeft: 2 }] };
  const r = applyAction(g, { type: "moveTo", node: "n3" }, TEST_WORLD); // costs 3 > 2
  expect(r.ok).toBe(false);
  expect(r.reason).toMatch(/time/i);
  expect(r.state.players[0].position).toBe("n0"); // unchanged
  expect(r.state.players[0].timeLeft).toBe(2);    // unchanged
});

test("moveTo is rejected when not in playing phase", () => {
  const g = newGame(); // still in setup
  const r = applyAction(g, { type: "moveTo", node: "n3" }, TEST_WORLD);
  expect(r.ok).toBe(false);
  expect(r.reason).toMatch(/playing/i);
});

test("moveTo to an unknown node is rejected, not thrown", () => {
  const g = applyAction(newGame(), { type: "setGoals", goals: newGame().goals }, TEST_WORLD).state;
  const r = applyAction(g, { type: "moveTo", node: "ghost" }, TEST_WORLD);
  expect(r.ok).toBe(false);
  expect(r.reason).toMatch(/node/i);
});
