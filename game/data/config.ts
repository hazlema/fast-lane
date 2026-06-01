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
  sicknessTimePenalty: 8,      // time units lost each week you're sick (supersedes hunger)
  sicknessWeeks: 2,            // weeks a bout of food-poisoning sickness lasts
  doctorBill: 50,              // auto-charged when you fall sick (cash first, remainder → debt)
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

  // Weekend events (Mechanic 9) — each rolls its own independent per-week chance
  muggerChance: 0.02,          // weekly chance of a mugging (rare — and you can bank to dodge it)
  muggerStartsAfterWeek: 20,   // no muggers until after this week (early-game grace)
  concertChance: 0.2,          // weekly chance of a concert
  concertHappiness: 10,        // happiness from a weekend concert
  windfallChance: 0.1,         // weekly chance of a lucky cash find
  windfallMin: 50,             // smallest lucky-find cash windfall
  windfallMax: 150,            // largest lucky-find cash windfall

  // Economic crisis (Mechanic 10) — layoffs / pay-cuts when the index hits extremes
  crisisLowBand: 0.6,          // index at/below this = a deflationary crisis
  crisisHighBand: 1.5,         // index at/above this = a runaway-inflation crisis
  crisisLayoffChance: 0.25,    // base weekly layoff odds in a crisis (÷ job tier — good jobs rarely fired)
  crisisPayCutChance: 0.5,     // weekly odds of a pay-cut (demotion) in a crisis, if not laid off
  computerIncome: 30,          // passive cash a computer earns each week (a home business)
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
