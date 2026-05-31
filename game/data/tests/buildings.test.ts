// game/data/buildings.test.ts
import { test, expect } from "bun:test";
import { BUILDINGS, TEST_BUILDINGS, buildingAt, hasService } from "../buildings";
import { BOARD, testRing } from "../board";

test("every real building sits on a real board node, one per node", () => {
  const nodes = BUILDINGS.map((b) => b.node).sort();
  expect(nodes).toEqual([...BOARD.nodes].sort());
});

test("every test building sits on a testRing node", () => {
  for (const b of TEST_BUILDINGS) expect(testRing.nodes).toContain(b.node);
});

test("buildingAt finds the building on a node, or undefined", () => {
  expect(buildingAt(BUILDINGS, "bank")?.id).toBe("bank");
  expect(buildingAt(BUILDINGS, "nope")).toBeUndefined();
});

test("hasService detects a service kind on a building", () => {
  const bank = buildingAt(BUILDINGS, "bank")!;
  expect(hasService(bank, "bank")).toBe(true);
  expect(hasService(bank, "shop")).toBe(false);
});

test("the real board offers each core service somewhere", () => {
  const kinds = new Set(BUILDINGS.flatMap((b) => b.services.map((s) => s.kind)));
  for (const k of ["workplace", "hiring", "education", "shop", "bank", "housing"]) {
    expect(kinds.has(k as never)).toBe(true);
  }
});
