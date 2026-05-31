// game/engine/economy.test.ts
import { test, expect } from "bun:test";
import { accrueInterest, checkPromotion, decayHappiness } from "../economy";
import { createGame } from "../state";
import { CONFIG } from "../../data/config";

function player(over: Partial<ReturnType<typeof createGame>["players"][number]>) {
  return { ...createGame({ playerName: "Al", startNode: "n0", seed: 1 }).players[0], ...over };
}

test("accrueInterest adds bank interest and loan interest, rounded", () => {
  const p = accrueInterest(player({ bank: 1000, debt: 200 }));
  expect(p.bank).toBe(1000 + Math.round(1000 * CONFIG.bankInterestRate)); // +20
  expect(p.debt).toBe(200 + Math.round(200 * CONFIG.loanInterestRate));   // +10
});

test("checkPromotion raises careerLevel when experience and education suffice", () => {
  const p = checkPromotion(player({
    jobId: "janitor",
    careerLevel: 0,
    experience: CONFIG.promotionExperience,
    education: CONFIG.educationPerCareerLevel, // needs 20 for level 1
  }));
  expect(p.careerLevel).toBe(1);
  expect(p.experience).toBe(0); // consumed
});

test("checkPromotion does nothing without enough education", () => {
  const p = checkPromotion(player({
    jobId: "janitor", careerLevel: 0, experience: CONFIG.promotionExperience, education: 0,
  }));
  expect(p.careerLevel).toBe(0);
  expect(p.experience).toBe(CONFIG.promotionExperience);
});

test("checkPromotion does nothing without a job", () => {
  const p = checkPromotion(player({ jobId: null, experience: 99, education: 999 }));
  expect(p.careerLevel).toBe(0);
});

test("decayHappiness drops happiness but not below zero", () => {
  expect(decayHappiness(player({ happiness: 3 })).happiness).toBe(0);
  expect(decayHappiness(player({ happiness: 50 })).happiness).toBe(50 - CONFIG.happinessDecayPerWeek);
});
