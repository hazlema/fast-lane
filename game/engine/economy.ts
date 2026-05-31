// game/engine/economy.ts
import type { Player } from "./state";
import { CONFIG } from "../data/config";

// Weekly bank + loan interest.
export function accrueInterest(p: Player): Player {
  return {
    ...p,
    bank: p.bank + Math.round(p.bank * CONFIG.bankInterestRate),
    debt: p.debt + Math.round(p.debt * CONFIG.loanInterestRate),
  };
}

// Pay weekly rent from cash; any shortfall becomes debt (gentle failure).
export function settleRent(p: Player): Player {
  const owed = p.weeklyRent;
  const paid = Math.min(owed, p.cash);
  return { ...p, cash: p.cash - paid, debt: p.debt + (owed - paid) };
}

// Promote one level if employed, experienced enough, and educated enough for the next level.
export function checkPromotion(p: Player): Player {
  if (!p.jobId) return p;
  const needEducation = CONFIG.educationPerCareerLevel * (p.careerLevel + 1);
  if (p.experience >= CONFIG.promotionExperience && p.education >= needEducation) {
    return { ...p, careerLevel: p.careerLevel + 1, experience: p.experience - CONFIG.promotionExperience };
  }
  return p;
}

// Happiness drifts down each week, floored at zero.
export function decayHappiness(p: Player): Player {
  return { ...p, happiness: Math.max(0, p.happiness - CONFIG.happinessDecayPerWeek) };
}
