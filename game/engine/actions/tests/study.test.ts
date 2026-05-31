// game/engine/actions/study.test.ts
import { test, expect } from "bun:test";
import { applyAction } from "../../reducer";
import { createGame } from "../../state";
import { TEST_WORLD } from "../../../data/world";
import { CONFIG } from "../../../data/config";

function enrolledAtUniversity(over = {}) {
  let g = createGame({ playerName: "Al", startNode: "n3", seed: 1 }); // university = n3
  g = applyAction(g, { type: "setGoals", goals: g.goals }, TEST_WORLD).state;
  g = { ...g, players: [{ ...g.players[0], cash: 1000, ...over }] };
  g = applyAction(g, { type: "enroll", course: "juniorcollege" }, TEST_WORLD).state;
  return g;
}

test("study costs time and graduates after the configured sessions, granting exactly the course's education", () => {
  // Plenty of time so all sessions fit (this exercises the study mechanic, not
  // the weekly budget — which is smaller than a full degree).
  let g = enrolledAtUniversity({ timeLeft: CONFIG.studySessionsToGraduate + 5 });
  const c = TEST_WORLD.courses.juniorcollege;
  let t = g.players[0].timeLeft;
  for (let i = 0; i < CONFIG.studySessionsToGraduate; i++) {
    const r = applyAction(g, { type: "study" }, TEST_WORLD);
    expect(r.ok).toBe(true);
    g = r.state;
    t -= c.timeCost;
    expect(g.players[0].timeLeft).toBe(t);
  }
  const p = g.players[0];
  expect(p.education).toBe(c.educationGain); // exactly, after graduation
  expect(p.enrolledCourse).toBeNull();        // graduated → free to enroll again
  expect(p.courseProgress).toBe(0);
  expect(p.completedCourses).toContain("juniorcollege"); // degree recorded
});

test("study accrues partial education before graduating", () => {
  let g = enrolledAtUniversity();
  g = applyAction(g, { type: "study" }, TEST_WORLD).state;
  const p = g.players[0];
  expect(p.enrolledCourse).toBe("juniorcollege");    // still enrolled
  expect(p.education).toBeGreaterThan(0);             // partial credit
  expect(p.education).toBeLessThan(TEST_WORLD.courses.juniorcollege.educationGain);
  expect(p.courseProgress).toBe(1);
});

test("study is rejected when not enrolled", () => {
  let g = createGame({ playerName: "Al", startNode: "n3", seed: 1 });
  g = applyAction(g, { type: "setGoals", goals: g.goals }, TEST_WORLD).state;
  const r = applyAction(g, { type: "study" }, TEST_WORLD);
  expect(r.ok).toBe(false);
  expect(r.reason).toMatch(/enroll/i);
});

test("study is rejected without enough time", () => {
  const g = enrolledAtUniversity({ });
  const low = { ...g, players: [{ ...g.players[0], timeLeft: 0 }] }; // studying costs 1 unit
  const r = applyAction(low, { type: "study" }, TEST_WORLD);
  expect(r.ok).toBe(false);
  expect(r.reason).toMatch(/time/i);
});

test("study is rejected away from a university", () => {
  const g = enrolledAtUniversity();
  const moved = { ...g, players: [{ ...g.players[0], position: "n4" }] }; // bank
  const r = applyAction(moved, { type: "study" }, TEST_WORLD);
  expect(r.ok).toBe(false);
  expect(r.reason).toMatch(/university|study|here/i);
});
