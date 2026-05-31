// game/engine/realboard.test.ts
import { test, expect } from "bun:test";
import { applyAction, type Action } from "./reducer";
import { createGame } from "./state";
import { WORLD } from "../data/world"; // the REAL board
import { CONFIG } from "../data/config";

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

test("a player can study a degree on the real board and win easy goals", () => {
  let g = createGame({ playerName: "Al", startNode: "university", seed: 3 });
  g = applyAction(g, {
    type: "setGoals",
    goals: { wealth: 100, happiness: 0, education: 20, career: 0 },
  }, WORLD).state;

  // Study Junior College to graduation (a degree fills the week), then settle.
  g = run(g, [
    { type: "enroll", course: "juniorcollege" },
    ...Array.from({ length: CONFIG.studySessionsToGraduate }, () => ({ type: "study" }) as const),
  ]);
  expect(g.players[0].completedCourses).toContain("juniorcollege");
  expect(g.players[0].education).toBe(20);

  const r = applyAction(g, { type: "endWeek" }, WORLD);
  expect(r.ok).toBe(true);
  expect(r.state.phase).toBe("won"); // wealth 150, education 20, happiness 0, career 0
});
