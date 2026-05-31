// game/engine/calendar.test.ts
import { test, expect } from "bun:test";
import { monthOf, weekOfMonth, isMonthEnd } from "./calendar";

test("monthOf groups weeks into 4-week months", () => {
  expect(monthOf(1)).toBe(1);
  expect(monthOf(4)).toBe(1);
  expect(monthOf(5)).toBe(2);
  expect(monthOf(8)).toBe(2);
  expect(monthOf(9)).toBe(3);
});

test("weekOfMonth cycles 1..4", () => {
  expect(weekOfMonth(1)).toBe(1);
  expect(weekOfMonth(4)).toBe(4);
  expect(weekOfMonth(5)).toBe(1);
});

test("isMonthEnd is true only on the 4th week of a month", () => {
  expect(isMonthEnd(4)).toBe(true);
  expect(isMonthEnd(8)).toBe(true);
  expect(isMonthEnd(1)).toBe(false);
  expect(isMonthEnd(5)).toBe(false);
});
