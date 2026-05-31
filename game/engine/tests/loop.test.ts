// game/engine/tests/loop.test.ts
import { test, expect, afterEach } from "bun:test";
import { newGame, step, setTrace, type TraceEntry } from "../loop";
import { TEST_WORLD } from "../../data/world";

afterEach(() => setTrace(null)); // never leak the trace hook between tests

test("newGame starts a fresh game in the setup phase", () => {
  const g = newGame({ playerName: "Al", startNode: "n0", seed: 1 });
  expect(g.phase).toBe("setup");
  expect(g.week).toBe(1);
});

test("step advances the game and returns the reducer result", () => {
  const g = newGame({ playerName: "Al", startNode: "n0", seed: 1 });
  const r = step(g, { type: "setGoals", goals: g.goals }, TEST_WORLD);
  expect(r.ok).toBe(true);
  expect(r.state.phase).toBe("playing");
});

test("setTrace observes every step; null stops it", () => {
  const seen: TraceEntry[] = [];
  setTrace((e) => seen.push(e));

  let g = newGame({ playerName: "Al", startNode: "n0", seed: 1 });
  g = step(g, { type: "setGoals", goals: g.goals }, TEST_WORLD).state;
  step(g, { type: "work" }, TEST_WORLD); // rejected — no job

  expect(seen.map((e) => e.action.type)).toEqual(["setGoals", "work"]);
  expect(seen[0]).toMatchObject({ phase: "setup", ok: true });   // phase BEFORE the action
  expect(seen[1]).toMatchObject({ phase: "playing", ok: false }); // work rejected
  expect(seen[1].reason).toMatch(/job/i);

  setTrace(null);
  step(g, { type: "endWeek" }, TEST_WORLD);
  expect(seen).toHaveLength(2); // nothing added after setTrace(null)
});
