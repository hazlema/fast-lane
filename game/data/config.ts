// game/data/config.ts
// Central tunables. Adjusting the economy = editing this file, not logic.
export const CONFIG = {
  weeklyTimeBudget: 60, // time units available each week
  hopCost: 5,           // time units per waypoint hop traveled
  startingCash: 200,
  startingBank: 0,

  // Economy (Plan 2)
  bankInterestRate: 0.02,      // weekly interest earned on savings
  loanInterestRate: 0.05,      // weekly interest charged on debt
  happinessDecayPerWeek: 5,    // happiness lost each week-end
  applyJobTimeCost: 5,         // time units to apply for a job
  promotionExperience: 5,      // work shifts of experience needed per promotion
  educationPerCareerLevel: 20, // education required to reach each next career level
  careerWageBonus: 0.25,       // +25% wage per career level

  defaultGoals: {
    wealth: 5000,
    happiness: 100,
    education: 100,
    career: 5,
  },
} as const;
