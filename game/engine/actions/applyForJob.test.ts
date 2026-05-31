// game/engine/actions/applyForJob.test.ts
import { test, expect } from "bun:test";
import { applyAction } from "../reducer";
import { createGame } from "../state";
import { WORLD } from "../../data/world";
import { CONFIG } from "../../data/config";

// Playing game with the player at the employment office (node n2).
function atEmployment() {
  let g = createGame({ playerName: "Al", startNode: "n2", seed: 1 });
  g = applyAction(g, { type: "setGoals", goals: g.goals }, WORLD).state;
  return g;
}

test("applying for a job you qualify for sets jobId and costs time", () => {
  const g = atEmployment();
  const r = applyAction(g, { type: "applyForJob", job: "janitor" }, WORLD); // requires education 0
  expect(r.ok).toBe(true);
  expect(r.state.players[0].jobId).toBe("janitor");
  expect(r.state.players[0].timeLeft).toBe(CONFIG.weeklyTimeBudget - CONFIG.applyJobTimeCost);
});

test("applying is rejected without enough education", () => {
  const g = atEmployment(); // education 0
  const r = applyAction(g, { type: "applyForJob", job: "engineer" }, WORLD); // requires 60
  expect(r.ok).toBe(false);
  expect(r.reason).toMatch(/education/i);
});

test("applying is rejected away from a hiring building", () => {
  let g = atEmployment();
  g = { ...g, players: [{ ...g.players[0], position: "n4" }] }; // bank, no hiring
  const r = applyAction(g, { type: "applyForJob", job: "janitor" }, WORLD);
  expect(r.ok).toBe(false);
  expect(r.reason).toMatch(/hiring|employment|here/i);
});

test("applying for a job not offered here is rejected", () => {
  const g = atEmployment();
  const r = applyAction(g, { type: "applyForJob", job: "ghostjob" }, WORLD);
  expect(r.ok).toBe(false);
  expect(r.reason).toMatch(/offered|job/i);
});
