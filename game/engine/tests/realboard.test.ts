// game/engine/realboard.test.ts
import { test, expect } from "bun:test";
import { applyAction } from "../reducer";
import { createGame, type GameState } from "../state";
import { WORLD } from "../../data/world"; // the REAL board

// Study the enrolled course to graduation, ending the week when time runs out.
function studyToGraduate(start: GameState, course: string): GameState {
  let g = applyAction(start, { type: "enroll", course }, WORLD).state;
  let guard = 0;
  while (!g.players[0].completedCourses.includes(course) && guard++ < 500) {
    const r = applyAction(g, { type: "study" }, WORLD);
    g = r.ok ? r.state : applyAction(g, { type: "endWeek" }, WORLD).state;
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

  g = studyToGraduate(g, "juniorcollege"); // spans several 20-unit weeks
  expect(g.players[0].completedCourses).toContain("juniorcollege");
  expect(g.players[0].education).toBe(20);

  const r = applyAction(g, { type: "endWeek" }, WORLD);
  expect(r.ok).toBe(true);
  expect(r.state.phase).toBe("won"); // wealth 150, education 20, happiness 0, career 0
});
