// game/engine/rng.test.ts
import { test, expect } from "bun:test";
import { makeRng, randInt } from "../rng";

test("same seed produces the same sequence", () => {
  const a = makeRng(123);
  const b = makeRng(123);
  expect([a(), a(), a()]).toEqual([b(), b(), b()]);
});

test("different seeds diverge", () => {
  const a = makeRng(1);
  const b = makeRng(2);
  expect(a()).not.toEqual(b());
});

test("randInt stays within inclusive bounds", () => {
  const next = makeRng(42);
  for (let i = 0; i < 1000; i++) {
    const n = randInt(next, 3, 7);
    expect(n).toBeGreaterThanOrEqual(3);
    expect(n).toBeLessThanOrEqual(7);
  }
});
