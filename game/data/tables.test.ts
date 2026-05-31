// game/data/tables.test.ts
import { test, expect } from "bun:test";
import { JOBS } from "./jobs";
import { COURSES } from "./courses";
import { ITEMS } from "./items";
import { HOUSING } from "./housing";

test("each table is keyed by its entries' own id", () => {
  for (const [key, job] of Object.entries(JOBS)) expect(job.id).toBe(key);
  for (const [key, c] of Object.entries(COURSES)) expect(c.id).toBe(key);
  for (const [key, i] of Object.entries(ITEMS)) expect(i.id).toBe(key);
  for (const [key, h] of Object.entries(HOUSING)) expect(h.id).toBe(key);
});

test("tables are non-empty and have sane positive costs", () => {
  expect(Object.keys(JOBS).length).toBeGreaterThan(0);
  for (const job of Object.values(JOBS)) {
    expect(job.wage).toBeGreaterThan(0);
    expect(job.timeCost).toBeGreaterThan(0);
  }
  for (const c of Object.values(COURSES)) {
    expect(c.cost).toBeGreaterThanOrEqual(0);
    expect(c.educationGain).toBeGreaterThan(0);
  }
  for (const h of Object.values(HOUSING)) expect(h.monthlyRent).toBeGreaterThanOrEqual(0);
});
