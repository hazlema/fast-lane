// game/engine/playthrough.test.ts
import { test, expect } from "bun:test";
import { applyAction } from "./reducer";
import { createGame, type GameState } from "./state";
import { TEST_WORLD } from "../data/world";

// Enroll, then study the course to graduation — ending the week whenever time
// runs out. A degree takes more study sessions than fit in one week, so this
// naturally spans multiple weeks.
function studyToGraduate(start: GameState, course: string): GameState {
  let g = applyAction(start, { type: "enroll", course }, TEST_WORLD).state;
  let guard = 0;
  while (!g.players[0].completedCourses.includes(course) && guard++ < 500) {
    const r = applyAction(g, { type: "study" }, TEST_WORLD);
    g = r.ok ? r.state : applyAction(g, { type: "endWeek" }, TEST_WORLD).state;
  }
  return g;
}

test("a multi-week run reaches a win against easy goals", () => {
  let g = createGame({ playerName: "Al", startNode: "n3", seed: 7 }); // start at university (n3)
  // Easy goals: happiness target 0 (it decays at week-end); no career required.
  g = applyAction(g, {
    type: "setGoals",
    goals: { wealth: 100, happiness: 0, education: 20, career: 0 },
  }, TEST_WORLD).state;

  g = studyToGraduate(g, "juniorcollege");
  expect(g.players[0].completedCourses).toContain("juniorcollege");
  expect(g.players[0].education).toBe(20); // graduated → full education granted
  expect(g.players[0].cash).toBe(150);     // 200 − 50 tuition (no work)

  // Settle the week → the easy goals are met (wealth 150, education 20,
  // happiness 0, career 0) → win.
  const r = applyAction(g, { type: "endWeek" }, TEST_WORLD);
  expect(r.ok).toBe(true);
  expect(r.state.phase).toBe("won");
});
