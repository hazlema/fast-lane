// game/data/world.test.ts
import { test, expect } from "bun:test";
import { makeWorld, WORLD, TEST_WORLD } from "../world";
import { BOARD, testRing } from "../board";
import { TEST_BUILDINGS } from "../buildings";

test("WORLD uses the real 13-node board", () => {
  expect(WORLD.graph.nodes.length).toBe(13);
  expect(WORLD.buildings.length).toBe(13);
});

test("TEST_WORLD uses the testRing fixture", () => {
  expect(TEST_WORLD.graph).toBe(testRing);
  expect(TEST_WORLD.buildings).toBe(TEST_BUILDINGS);
});

test("makeWorld rejects a building wired to a node outside the graph", () => {
  const bad = [{ id: "x", name: "X", hitBoxId: "X", node: "nowhere", services: [] }];
  expect(() => makeWorld(BOARD, bad)).toThrow(/unknown node/i);
});
