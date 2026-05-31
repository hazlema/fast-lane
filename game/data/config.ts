// game/data/config.ts
// Central tunables. Adjusting the economy = editing this file, not logic.
export const CONFIG = {
  weeklyTimeBudget: 60, // time units available each week
  hopCost: 5,           // time units per waypoint hop traveled
  startingCash: 200,
  startingBank: 0,
  defaultGoals: {
    wealth: 5000,
    happiness: 100,
    education: 100,
    career: 5,
  },
} as const;
