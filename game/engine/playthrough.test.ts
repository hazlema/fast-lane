// game/engine/playthrough.test.ts
import { test, expect } from "bun:test";
import { applyAction, type Action } from "./reducer";
import { createGame } from "./state";
import { TEST_WORLD } from "../data/world";

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

// Route fits the 60-unit weekly budget: study 15×3 + move(n3→n2) 5 + apply 5 = 55.
test("a productive week reaches a win against easy goals", () => {
  let g = createGame({ playerName: "Al", startNode: "n3", seed: 7 }); // start at university (n3)
  // Easy goals: happiness target 0 (it decays at week-end); no career required.
  g = applyAction(g, {
    type: "setGoals",
    goals: { wealth: 100, happiness: 0, education: 20, career: 0 },
  }, TEST_WORLD).state;

  g = run(g, [
    { type: "enroll", course: "juniorcollege" }, // n3: pay 50 tuition, lock in Junior College
    { type: "study" },                       // +partial edu, -15 time
    { type: "study" },                       // +partial edu, -15 time
    { type: "study" },                       // graduates Junior College → education 20, -15 time
    { type: "moveTo", node: "n2" },          // to employment office (1 hop)
    { type: "applyForJob", job: "clerk" },   // Clerk requires the Junior College degree ✓
  ]);

  const mid = g.players[0];
  expect(mid.jobId).toBe("clerk");
  expect(mid.education).toBe(20);            // graduated Junior College
  expect(mid.enrolledCourse).toBeNull();
  expect(mid.cash).toBe(150);                // 200 start − 50 tuition (no work this week)

  // Settle the week → wealth 150, education 20, happiness 0, career 0 → win.
  const r = applyAction(g, { type: "endWeek" }, TEST_WORLD);
  expect(r.ok).toBe(true);
  expect(r.state.phase).toBe("won");
});
