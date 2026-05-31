// game/data/buildings.test.ts
import { test, expect } from "bun:test";
import { BUILDINGS, buildingAt, hasService } from "./buildings";
import { testRing } from "./board";

test("every building sits on a real ring node", () => {
  for (const b of BUILDINGS) expect(testRing.nodes).toContain(b.node);
});

test("buildingAt finds the building on a node, or undefined", () => {
  const bank = BUILDINGS.find((b) => b.id === "bank")!;
  expect(buildingAt(BUILDINGS, bank.node)?.id).toBe("bank");
  const empty = testRing.nodes.find((n) => !BUILDINGS.some((b) => b.node === n));
  if (empty) expect(buildingAt(BUILDINGS, empty)).toBeUndefined();
});

test("hasService detects a service kind on a building", () => {
  const bank = BUILDINGS.find((b) => b.id === "bank")!;
  expect(hasService(bank, "bank")).toBe(true);
  expect(hasService(bank, "shop")).toBe(false);
});
