// game/engine/wages.test.ts
import { test, expect } from "bun:test";
import { wageFor } from "./wages";
import type { Job } from "../data/jobs";

const job: Job = { id: "x", title: "X", buildingId: "b", wage: 100, timeCost: 10, requiredEducation: 0 };

test("wage at career level 0 is the base wage", () => {
  expect(wageFor(job, 0)).toBe(100);
});

test("each career level adds the configured bonus", () => {
  // 100 × (1 + 2 × 0.25) = 150
  expect(wageFor(job, 2)).toBe(150);
});

test("wage is rounded to a whole number", () => {
  // 100 × (1 + 1 × 0.25) = 125 (already whole); use a base that would fraction
  const j2 = { ...job, wage: 90 };
  // 90 × (1 + 1 × 0.25) = 112.5 → 113
  expect(wageFor(j2, 1)).toBe(113);
});
