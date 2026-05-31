// game/engine/movement.test.ts
import { test, expect } from "bun:test";
import { travelCost } from "../movement";
import { testRing } from "../../data/board";
import { CONFIG } from "../../data/config";

test("travelCost is hops × hopCost at default multiplier", () => {
  // n0 -> n3 = 3 hops; 3 × 5 = 15
  expect(travelCost(testRing, "n0", "n3", 1)).toBe(3 * CONFIG.hopCost);
});

test("travelCost is zero for staying put", () => {
  expect(travelCost(testRing, "n2", "n2", 1)).toBe(0);
});

test("travel multiplier discounts cost and rounds up", () => {
  // 3 hops × 1 = 3; ×0.6 = 1.8 → ceil → 2 (exercises the rounding-up policy)
  expect(travelCost(testRing, "n0", "n3", 0.6)).toBe(2);
  // 2 hops × 1 = 2; ×0.6 = 1.2 → ceil → 2
  expect(travelCost(testRing, "n0", "n6", 0.6)).toBe(2);
  // 1 hop × 1 = 1; ×0.5 = 0.5 → ceil → 1
  expect(travelCost(testRing, "n0", "n1", 0.5)).toBe(1);
});

test("travel multiplier defaults to 1 when omitted", () => {
  expect(travelCost(testRing, "n0", "n3")).toBe(3); // 3 hops × hopCost 1
});
