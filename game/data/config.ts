// game/data/config.ts
// Central tunables. Adjusting the economy = editing this file, not logic.
export const CONFIG = {
  weeklyTimeBudget: 8,  // action units available each week (small: ~2 work shifts + a couple errands)
  hopCost: 1,           // time units per waypoint hop traveled (travel time scales with distance)
  weeksPerMonth: 4,    // a "month" is 4 weeks (rent + inflation cadence)

  // Economy index (fluctuating inflation; Mechanic 10)
  indexStart: 1.0,     // starting economic index
  indexStepMax: 0.08,  // max +/- change per week
  indexFloor: 0.5,     // cheapest economy (deflation)
  indexCeil: 1.8,      // most expensive economy (high inflation)

  startingCash: 200,
  startingBank: 0,

  // Economy (Plan 2)
  bankInterestRate: 0.02,      // weekly interest earned on savings
  loanInterestRate: 0.05,      // weekly interest charged on debt
  happinessDecayPerWeek: 5,    // happiness lost each week-end
  applyJobTimeCost: 1,         // time units to apply for a job
  promotionExperience: 5,      // work shifts of experience needed per promotion
  educationPerCareerLevel: 20, // education required to reach each next career level
  studySessionsToGraduate: 3,  // study visits to finish a course (Plan 6b)
  careerWageBonus: 0.25,       // +25% wage per career level

  defaultGoals: {
    wealth: 5000,
    happiness: 100,
    education: 100,
    career: 5,
  },
} as const;
