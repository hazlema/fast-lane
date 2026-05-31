// game/engine/wages.test.ts
import { test, expect } from "bun:test";
import { wageFor } from "../wages";
import type { Job } from "../../data/jobs";

const job: Job = { id: "x", title: "X", buildingId: "b", wage: 100, timeCost: 10, requiredDegrees: [], requiredExperience: 0, requiredDependability: 0 };

test("wage at career level 0 and a normal economy is the base wage", () => {
  expect(wageFor(job, 0, 1)).toBe(100);
});

test("each career level adds the configured bonus", () => {
  expect(wageFor(job, 2, 1)).toBe(150); // 100 × (1 + 2 × 0.25)
});

test("wage is rounded to a whole number", () => {
  const j2 = { ...job, wage: 90 };
  expect(wageFor(j2, 1, 1)).toBe(113); // 90 × 1.25 = 112.5 → 113
});

test("higher inflation lowers take-home (inverse), lower inflation raises it", () => {
  expect(wageFor(job, 0, 2)).toBe(50);   // index 2 → half pay
  expect(wageFor(job, 0, 0.5)).toBe(200); // index 0.5 → double pay
});

test("economyIndex defaults to 1 (no effect) when omitted", () => {
  expect(wageFor(job, 0)).toBe(100);
});
