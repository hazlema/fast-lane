// game/engine/playthrough.test.ts
import { test, expect } from "bun:test";
import { applyAction, type Action } from "./reducer";
import { createGame } from "./state";
import { TEST_WORLD } from "../data/world";
import { CONFIG } from "../data/config";

// Apply a sequence, asserting each step succeeds; returns the final state.
function run(start: ReturnType<typeof createGame>, actions: Action[]) {
  let g = start;
  for (const a of actions) {
    const r = applyAction(g, a, TEST_WORLD);
    if (!r.ok) throw new Error(`action ${a.type} rejected: ${r.reason}`);
    g = r.state;
  }
  return g;
}

// School is a long grind: a degree takes studySessionsToGraduate study visits
// (≈ a whole week of study), so the run spans multiple weeks.
test("a multi-week run reaches a win against easy goals", () => {
  let g = createGame({ playerName: "Al", startNode: "n3", seed: 7 }); // start at university (n3)
  // Easy goals: happiness target 0 (it decays at week-end); no career required.
  g = applyAction(g, {
    type: "setGoals",
    goals: { wealth: 100, happiness: 0, education: 20, career: 0 },
  }, TEST_WORLD).state;

  // Week 1: enroll and study Junior College to graduation (fills the week).
  g = run(g, [
    { type: "enroll", course: "juniorcollege" }, // pay 50 tuition, lock in
    ...Array.from({ length: CONFIG.studySessionsToGraduate }, () => ({ type: "study" }) as const),
  ]);
  expect(g.players[0].completedCourses).toContain("juniorcollege");
  expect(g.players[0].education).toBe(20);   // graduated → full education granted
  expect(g.players[0].enrolledCourse).toBeNull();
  expect(g.players[0].cash).toBe(150);       // 200 − 50 tuition (no work)

  // Settle the week → the easy goals are met (wealth 150, education 20,
  // happiness 0, career 0) → win.
  const r = applyAction(g, { type: "endWeek" }, TEST_WORLD);
  expect(r.ok).toBe(true);
  expect(r.state.phase).toBe("won");
});
