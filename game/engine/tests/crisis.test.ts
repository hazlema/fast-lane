// game/engine/tests/crisis.test.ts
import { test, expect } from "bun:test";
import { rollCrisis, inCrisis } from "../crisis";
import { createGame } from "../state";
import { CONFIG } from "../../data/config";

const p = (over: Partial<ReturnType<typeof createGame>["players"][number]> = {}) => ({
  ...createGame({ playerName: "A", startNode: "n0", seed: 1 }).players[0],
  ...over,
});

test("inCrisis flags only the extreme bands", () => {
  expect(inCrisis(1.0)).toBe(false);
  expect(inCrisis(CONFIG.crisisLowBand)).toBe(true);
  expect(inCrisis(CONFIG.crisisHighBand)).toBe(true);
});

test("no crisis in a normal economy", () => {
  for (let w = 1; w <= 50; w++) expect(rollCrisis(p({ jobId: "janitor" }), 1.0, 7, w)).toBeNull();
});

test("no crisis when you're unemployed", () => {
  for (let w = 1; w <= 50; w++) expect(rollCrisis(p({ jobId: null }), CONFIG.crisisLowBand, 7, w)).toBeNull();
});

test("a crisis can lay off an entry worker (job lost)", () => {
  let laid = false;
  for (let w = 1; w <= 50 && !laid; w++) {
    const r = rollCrisis(p({ jobId: "janitor" }), CONFIG.crisisLowBand, 7, w);
    if (r && /laid off/i.test(r.news)) { laid = true; expect(r.player.jobId).toBeNull(); }
  }
  expect(laid).toBe(true);
});

test("a crisis pay-cut demotes a career-level worker", () => {
  let cut = false;
  for (let w = 1; w <= 100 && !cut; w++) {
    const r = rollCrisis(p({ jobId: "janitor", careerLevel: 3 }), CONFIG.crisisHighBand, 7, w);
    if (r && /pay grade|career level/i.test(r.news)) { cut = true; expect(r.player.careerLevel).toBe(2); }
  }
  expect(cut).toBe(true);
});

test("good jobs are laid off less often than entry jobs", () => {
  const layoffs = (job: string) => {
    let n = 0;
    for (let w = 1; w <= 400; w++) {
      const r = rollCrisis(p({ jobId: job, careerLevel: 0 }), CONFIG.crisisLowBand, 7, w);
      if (r && /laid off/i.test(r.news)) n++;
    }
    return n;
  };
  expect(layoffs("broker")).toBeLessThan(layoffs("janitor")); // 2-degree role vs entry
});
