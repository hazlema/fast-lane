// game/engine/realboard.test.ts
import { test, expect } from "bun:test";
import { applyAction, type Action } from "./reducer";
import { createGame } from "./state";
import { WORLD } from "../data/world"; // the REAL board

function run(start: ReturnType<typeof createGame>, actions: Action[]) {
  let g = start;
  for (const a of actions) {
    const r = applyAction(g, a, WORLD);
    if (!r.ok) throw new Error(`action ${a.type} rejected: ${r.reason}`);
    g = r.state;
  }
  return g;
}

test("buildings resolve on their own nodes on the real board", () => {
  // node id === building id, so a player standing on 'bank' is at the Bank.
  let g = createGame({ playerName: "Al", startNode: "bank", seed: 1 });
  g = applyAction(g, { type: "setGoals", goals: g.goals }, WORLD).state;
  g = { ...g, players: [{ ...g.players[0], cash: 500 }] };
  const r = applyAction(g, { type: "bank", op: "deposit", amount: 100 }, WORLD);
  expect(r.ok).toBe(true);
  expect(r.state.players[0].bank).toBe(100);
});

test("a player can travel the real ring, study, work, and win easy goals", () => {
  let g = createGame({ playerName: "Al", startNode: "university", seed: 3 });
  g = applyAction(g, {
    type: "setGoals",
    goals: { wealth: 100, happiness: 0, education: 20, career: 0 },
  }, WORLD).state;

  g = run(g, [
    { type: "enroll", course: "basics" },          // at university: pay tuition, lock in
    { type: "study" }, { type: "study" }, { type: "study" }, // graduate → education 20
    { type: "moveTo", node: "employment" },         // travel the ring (1 hop)
    { type: "applyForJob", job: "clerk" },          // needs education 20 ✓
    { type: "endWeek" },
  ]);

  expect(g.players[0].jobId).toBe("clerk");
  expect(g.players[0].education).toBe(20);
  expect(g.phase).toBe("won");
});
