// game/engine/actions/enroll.test.ts
import { test, expect } from "bun:test";
import { applyAction } from "../reducer";
import { createGame } from "../state";
import { TEST_WORLD } from "../../data/world";

function atUniversity(over = {}) {
  let g = createGame({ playerName: "Al", startNode: "n3", seed: 1 }); // university = n3
  g = applyAction(g, { type: "setGoals", goals: g.goals }, TEST_WORLD).state;
  g = { ...g, players: [{ ...g.players[0], cash: 1000, ...over }] };
  return g;
}

test("enroll pays tuition and locks in the course", () => {
  const g = atUniversity();
  const c = TEST_WORLD.courses.basics;
  const r = applyAction(g, { type: "enroll", course: "basics" }, TEST_WORLD);
  expect(r.ok).toBe(true);
  const p = r.state.players[0];
  expect(p.enrolledCourse).toBe("basics");
  expect(p.courseProgress).toBe(0);
  expect(p.cash).toBe(1000 - c.cost);
});

test("enroll is rejected while already enrolled", () => {
  let g = atUniversity();
  g = applyAction(g, { type: "enroll", course: "basics" }, TEST_WORLD).state;
  const r = applyAction(g, { type: "enroll", course: "business" }, TEST_WORLD);
  expect(r.ok).toBe(false);
  expect(r.reason).toMatch(/already enrolled/i);
});

test("enroll is rejected without enough cash for tuition", () => {
  const g = atUniversity({ cash: 10 }); // basics costs 50
  const r = applyAction(g, { type: "enroll", course: "basics" }, TEST_WORLD);
  expect(r.ok).toBe(false);
  expect(r.reason).toMatch(/afford|tuition|cash/i);
});

test("enroll is rejected away from a university", () => {
  const g = atUniversity();
  const moved = { ...g, players: [{ ...g.players[0], position: "n4" }] }; // bank
  const r = applyAction(moved, { type: "enroll", course: "basics" }, TEST_WORLD);
  expect(r.ok).toBe(false);
  expect(r.reason).toMatch(/class|university|here/i);
});
