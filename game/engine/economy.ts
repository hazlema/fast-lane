// game/engine/economy.ts
import type { Player } from "./state";
import { CONFIG } from "../data/config";
import { isEmployed } from "./checks";

// Weekly bank + loan interest.
export function accrueInterest(p: Player): Player {
  return {
    ...p,
    bank: p.bank + Math.round(p.bank * CONFIG.bankInterestRate),
    debt: p.debt + Math.round(p.debt * CONFIG.loanInterestRate),
  };
}

// Promote one level if employed, experienced enough, and educated enough for the next level.
export function checkPromotion(p: Player): Player {
  if (!isEmployed(p)) return p;
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
