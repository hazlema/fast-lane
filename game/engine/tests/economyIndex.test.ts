// game/engine/economyIndex.test.ts
import { test, expect } from "bun:test";
import { nextIndex } from "../economyIndex";
import { makeRng } from "../rng";
import { CONFIG } from "../../data/config";

test("nextIndex moves by at most indexStepMax", () => {
  const rand = makeRng(123);
  const v = nextIndex(1.0, rand);
  expect(Math.abs(v - 1.0)).toBeLessThanOrEqual(CONFIG.indexStepMax + 1e-9);
});

test("nextIndex is deterministic for a given seed", () => {
  expect(nextIndex(1.0, makeRng(42))).toBe(nextIndex(1.0, makeRng(42)));
});

test("nextIndex stays within [floor, ceil] over a long walk", () => {
  const rand = makeRng(7);
  let v = 1.0;
  for (let i = 0; i < 500; i++) {
    v = nextIndex(v, rand);
    expect(v).toBeGreaterThanOrEqual(CONFIG.indexFloor);
    expect(v).toBeLessThanOrEqual(CONFIG.indexCeil);
  }
});
