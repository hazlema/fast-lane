// game/engine/actions/applyForJob.test.ts
import { test, expect } from "bun:test";
import { applyAction } from "../reducer";
import { createGame } from "../state";
import { TEST_WORLD } from "../../data/world";
import { CONFIG } from "../../data/config";

// Playing game with the player at the employment office (node n2).
function atEmployment() {
  let g = createGame({ playerName: "Al", startNode: "n2", seed: 1 });
  g = applyAction(g, { type: "setGoals", goals: g.goals }, TEST_WORLD).state;
  return g;
}

test("applying for a job you qualify for sets jobId and costs time", () => {
  const g = atEmployment();
  const r = applyAction(g, { type: "applyForJob", job: "janitor" }, TEST_WORLD); // requires education 0
  expect(r.ok).toBe(true);
  expect(r.state.players[0].jobId).toBe("janitor");
  expect(r.state.players[0].timeLeft).toBe(CONFIG.weeklyTimeBudget - CONFIG.applyJobTimeCost);
});

test("applying for a job you're not qualified for still costs time but doesn't hire you", () => {
  const g = atEmployment(); // no degrees, no experience
  const before = g.players[0];
  const r = applyAction(g, { type: "applyForJob", job: "engineer" }, TEST_WORLD); // needs Engineering + Junior College
  expect(r.ok).toBe(true);                          // the application went through
  expect(r.state.players[0].jobId).toBeNull();      // but you weren't hired
  expect(r.state.players[0].timeLeft).toBe(before.timeLeft - CONFIG.applyJobTimeCost); // time spent anyway
  expect(r.state.log.some((e) => /not qualified/i.test(e.text))).toBe(true);
});

test("a qualified application for a specialised job costs time and either hires you or finds no opening", () => {
  let g = atEmployment();
  g = { ...g, players: [{ ...g.players[0], completedCourses: ["juniorcollege"] }] }; // qualifies for Clerk
  const before = g.players[0];
  const r = applyAction(g, { type: "applyForJob", job: "clerk" }, TEST_WORLD);
  expect(r.ok).toBe(true);
  expect(r.state.players[0].timeLeft).toBe(before.timeLeft - CONFIG.applyJobTimeCost); // time spent regardless
  const hired = r.state.players[0].jobId === "clerk";
  const noOpening = r.state.log.some((e) => /no openings/i.test(e.text));
  expect(hired || noOpening).toBe(true); // hired, or told there were no openings — never silently nothing
});

test("applying is rejected away from a hiring building", () => {
  let g = atEmployment();
  g = { ...g, players: [{ ...g.players[0], position: "n4" }] }; // bank, no hiring
  const r = applyAction(g, { type: "applyForJob", job: "janitor" }, TEST_WORLD);
  expect(r.ok).toBe(false);
  expect(r.reason).toMatch(/hiring|employment|here/i);
});

test("applying for a job not offered here is rejected", () => {
  const g = atEmployment();
  const r = applyAction(g, { type: "applyForJob", job: "ghostjob" }, TEST_WORLD);
  expect(r.ok).toBe(false);
  expect(r.reason).toMatch(/offered|job/i);
});

test("applying is rejected without enough time", () => {
  let g = atEmployment(); // janitor needs no education, so time is the only blocker
  g = { ...g, players: [{ ...g.players[0], timeLeft: 0 }] }; // applying costs applyJobTimeCost (1)
  const r = applyAction(g, { type: "applyForJob", job: "janitor" }, TEST_WORLD);
  expect(r.ok).toBe(false);
  expect(r.reason).toMatch(/time/i);
});
