// game/engine/board.test.ts
import { test, expect } from "bun:test";
import { hopsBetween, testRing } from "../../data/board";
import { BOARD, NODE_XY, BOARD_SIZE } from "../../data/board";
import { ringPath } from "../../data/board";

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

test("BOARD is a 13-node ring in clockwise order", () => {
  expect(BOARD.nodes).toEqual([
    "highsec", "rentoffice", "lowcost", "pawn", "discount", "frosty", "offrack",
    "electronics", "university", "employment", "factory", "bank", "tryandsave",
  ]);
});

test("hopsBetween works on the real board (shorter way around 13 nodes)", () => {
  expect(hopsBetween(BOARD, "highsec", "rentoffice")).toBe(1);
  expect(hopsBetween(BOARD, "highsec", "tryandsave")).toBe(1); // wraps backward
  expect(hopsBetween(BOARD, "highsec", "electronics")).toBe(6); // 7 fwd vs 6 back
});

test("NODE_XY has a coordinate for every board node, within the board", () => {
  for (const id of BOARD.nodes) {
    const xy = NODE_XY[id];
    expect(xy).toBeDefined();
    expect(xy.x).toBeGreaterThanOrEqual(0);
    expect(xy.x).toBeLessThanOrEqual(BOARD_SIZE.width);
    expect(xy.y).toBeGreaterThanOrEqual(0);
    expect(xy.y).toBeLessThanOrEqual(BOARD_SIZE.height);
  }
});

test("ringPath returns just the node when from === to", () => {
  expect(ringPath(BOARD, "highsec", "highsec")).toEqual(["highsec"]);
});

test("ringPath walks the shorter (forward) arc, inclusive", () => {
  expect(ringPath(BOARD, "highsec", "pawn")).toEqual(["highsec", "rentoffice", "lowcost", "pawn"]);
});

test("ringPath walks backward when that is shorter", () => {
  // highsec(0) -> tryandsave(12): backward is 1 hop
  expect(ringPath(BOARD, "highsec", "tryandsave")).toEqual(["highsec", "tryandsave"]);
});

test("ringPath length matches hopsBetween + 1", () => {
  expect(ringPath(BOARD, "highsec", "electronics").length).toBe(hopsBetween(BOARD, "highsec", "electronics") + 1);
});
