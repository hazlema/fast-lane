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

// Route is traced to fit the 60-unit weekly budget:
//   class 15 + move(n3→n2) 5 + apply 5 + move(n2→n1) 5 + work 15 + buy 5 = 50.
test("a productive week reaches a win against easy goals", () => {
  let g = createGame({ playerName: "Al", startNode: "n3", seed: 7 }); // start at university (n3)
  // Easy goals: happiness target 0 because happiness decays at week-end.
  g = applyAction(g, {
    type: "setGoals",
    goals: { wealth: 100, happiness: 0, education: 20, career: 0 },
  }, TEST_WORLD).state;

  // Play the week (everything before settling).
  g = run(g, [
    { type: "takeClass", course: "basics" },   // n3: +20 education, -50 cash
    { type: "moveTo", node: "n2" },            // to employment office (1 hop)
    { type: "applyForJob", job: "clerk" },     // needs education 20 ✓
    { type: "moveTo", node: "n1" },            // to Try and Save (clerk's workplace + a shop)
    { type: "work" },                          // +120 cash (career 0)
    { type: "buy", item: "burger" },           // +6 happiness, sold here
  ]);

  // Mid-week assertions (before week-end decay).
  const mid = g.players[0];
  expect(mid.jobId).toBe("clerk");
  expect(mid.education).toBeGreaterThanOrEqual(20);
  expect(mid.happiness).toBe(TEST_WORLD.items.burger.happinessGain); // 6
  expect(mid.cash).toBe(262); // 200 start − 50 class + 120 work − 8 burger

  // Settle the week → all four goals met → win.
  const r = applyAction(g, { type: "endWeek" }, TEST_WORLD);
  expect(r.ok).toBe(true);
  expect(r.state.phase).toBe("won"); // wealth 262, education 20, happiness≥0, career 0
});
