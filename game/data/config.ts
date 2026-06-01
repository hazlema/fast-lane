// game/data/config.ts
// Central tunables. Adjusting the economy = editing this file, not logic.
export const CONFIG = {
  weeklyTimeBudget: 24, // action units available each week (work/study/buy = 1 each; travel = 1/hop)
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
  noOpeningChance: 0.3,        // chance a qualified application finds no opening (entry jobs always hire)
  hungerTimePenalty: 5,        // time units lost next week if you didn't eat this week
  maxWeeksAbsent: 1,           // consecutive weeks you can skip work before your record turns "poor" (blocks new hires)
  fireAfterWeeks: 4,           // skip more than this many weeks in a row → your boss fires you
  evictAfterWeeks: 3,          // weeks rent can stay overdue before you're evicted (game over)
  clothingLastsWeeks: 8,       // weeks clothes stay wearable; past this you're in rags (can't work/study)
  lotteryWinChance: 0.12,      // chance a lottery ticket wins at next turn's draw
  lotteryMaxPrize: 400,        // top prize ($100..this, in $100 steps)
  relaxHappiness: 3,           // happiness from relaxing at home (per time unit)
  relaxTvBonus: 4,             // extra happiness when relaxing if you own a TV
  highSecHappiness: 3,         // weekly happiness bonus for living in High Security
  pawnSellFraction: 0.5,       // fraction of an item's cost the pawn shop pays back
  promotionExperience: 5,      // work shifts of experience needed per promotion
  educationPerCareerLevel: 20, // education required to reach each next career level
  studySessionsToGraduate: 30, // study visits to finish a degree (school is a long grind; each study = 1 unit, spans weeks)
  careerWageBonus: 0.25,       // +25% wage per career level

  defaultGoals: {
    wealth: 5000,
    happiness: 100,
    education: 100,
    career: 5,
  },
} as const;
