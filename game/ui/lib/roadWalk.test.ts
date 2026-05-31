// game/ui/lib/roadWalk.test.ts
import { test, expect } from "bun:test";
import { nodeOffsets, shorterArc, wrap, type Sampler } from "./roadWalk";

// A 10×10 square perimeter, length 40, starting at (0,0) going clockwise:
// top edge 0..10, right edge 10..20, bottom 20..30, left 30..40.
const square: Sampler = (len) => {
  const d = ((len % 40) + 40) % 40;
  if (d <= 10) return { x: d, y: 0 };
  if (d <= 20) return { x: 10, y: d - 10 };
  if (d <= 30) return { x: 10 - (d - 20), y: 10 };
  return { x: 0, y: 10 - (d - 30) };
};

test("nodeOffsets maps each node to the nearest path offset", () => {
  const ids = ["top", "right", "bottom", "left"] as const;
  const xy = {
    top: { x: 5, y: 0 }, right: { x: 10, y: 5 },
    bottom: { x: 5, y: 10 }, left: { x: 0, y: 5 },
  };
  const off = nodeOffsets([...ids], xy, square, 40, 400);
  expect(Math.abs(off.top - 5)).toBeLessThan(0.5);
  expect(Math.abs(off.right - 15)).toBeLessThan(0.5);
  expect(Math.abs(off.bottom - 25)).toBeLessThan(0.5);
  expect(Math.abs(off.left - 35)).toBeLessThan(0.5);
});

test("shorterArc picks the shorter direction and signs it", () => {
  expect(shorterArc(35, 5, 40)).toBe(10);    // wrap forward past the seam
  expect(shorterArc(5, 35, 40)).toBe(-10);   // backward is shorter
  expect(shorterArc(0, 10, 40)).toBe(10);    // plain forward
});

test("wrap keeps an offset within [0, total)", () => {
  expect(wrap(45, 40)).toBe(5);
  expect(wrap(-5, 40)).toBe(35);
  expect(wrap(10, 40)).toBe(10);
});
