// game/engine/board.test.ts
import { test, expect } from "bun:test";
import { hopsBetween, testRing, type BoardGraph } from "../data/board";

test("testRing is an ordered loop of 8 nodes", () => {
  expect(testRing.nodes.length).toBe(8);
});

test("hopsBetween returns 0 for same node", () => {
  expect(hopsBetween(testRing, "n0", "n0")).toBe(0);
});

test("hopsBetween takes the shorter way around the ring", () => {
  // n0..n7 ring. n0 -> n6 forward is 6, backward is 2 → expect 2.
  expect(hopsBetween(testRing, "n0", "n6")).toBe(2);
  expect(hopsBetween(testRing, "n0", "n3")).toBe(3);
  expect(hopsBetween(testRing, "n0", "n4")).toBe(4); // tie → 4 either way
});

test("hopsBetween throws on unknown node", () => {
  expect(() => hopsBetween(testRing, "n0", "nope")).toThrow();
});
