// game/engine/state.ts
import type { NodeId } from "../data/board";
import { CONFIG } from "../data/config";
import type { CourseId } from "../data/courses";

export type Stat = "wealth" | "happiness" | "education" | "career";
export type JobId = string;
export type ItemId = string;
export type HousingId = string;

export interface Player {
  id: string;
  name: string;
  position: NodeId;
  cash: number;
  bank: number;
  debt: number;
  happiness: number;
  education: number;
  careerLevel: number;
  jobId: JobId | null;
  experience: number; // progress toward promotion; consumed by Plan 2 career logic
  dependability: number;            // reliability record; rises with work, gates hiring
  ateThisWeek: boolean;             // bought a meal this week? (else a hunger time penalty next week)
  hungry: boolean;                  // is THIS week docked because you didn't eat last week?
  sick: boolean;                    // is THIS week docked by sickness? (HUD chip)
  sickWeeks: number;                // weeks of sickness remaining (food poisoning) — docks time
  workedThisWeek: boolean;          // worked a shift this week? (attendance)
  weeksSinceWorked: number;         // consecutive weeks employed-but-absent → poor work history → fired
  clothingWear: number;             // weeks your clothes have been worn; past CONFIG.clothingLastsWeeks → in rags
  enrolledCourse: CourseId | null;  // current University course, null if none
  courseProgress: number;           // study sessions completed toward graduation
  completedCourses: CourseId[];     // degrees earned (university tech tree)
  inventory: ItemId[];
  mealsStocked: number;        // frozen meals on hand — one is cooked a week to stay fed
  lotteryTicket: boolean;      // holding a ticket for next turn's lottery draw
  rentDue: number;             // accrued unpaid rent (paid at the Rent Office)
  weeksRentOverdue: number;    // consecutive weeks rent has gone unpaid → eviction
  housingId: HousingId | null; // current rented place
  timeLeft: number;
  travelMultiplier: number;
}

export interface LogEntry {
  week: number;
  text: string;
}

// The game-loop state machine (see engine/loop.ts):
//   setup → startTurn → playing → endTurn → (won | lost | back to startTurn)
// "startTurn"/"endTurn" are transient — gameLoop processes them and settles on
// "playing", "won", or "lost"; the game never rests in the transient ones.
export type Phase = "setup" | "startTurn" | "playing" | "endTurn" | "won" | "lost";

export interface GameState {
  players: Player[];
  current: number;
  week: number;
  phase: Phase;
  economyIndex: number;        // fluctuating inflation index (Mechanic 10)
  goals: Record<Stat, number>;
  seed: number;
  log: LogEntry[];
}

export function createGame(opts: {
  playerName: string;
  startNode: NodeId;
  seed: number;
  startHousing?: HousingId; // if set, the player begins already renting this unit
}): GameState {
  const player: Player = {
    id: "p0",
    name: opts.playerName,
    position: opts.startNode,
    cash: CONFIG.startingCash,
    bank: CONFIG.startingBank,
    debt: 0,
    happiness: 0,
    education: 0,
    careerLevel: 0,
    jobId: null,
    experience: 0,
    dependability: 0,
    ateThisWeek: true, // starting item: a meal that satisfies the first preflight; after that you must eat
    hungry: false,     // not docked going in
    sick: false,       // not sick this week
    sickWeeks: 0,      // healthy to start
    workedThisWeek: false,
    weeksSinceWorked: 0,
    clothingWear: 0, // you start decently dressed
    enrolledCourse: null,
    courseProgress: 0,
    completedCourses: [],
    inventory: [],
    mealsStocked: 0,
    lotteryTicket: false,
    rentDue: 0,
    weeksRentOverdue: 0,
    housingId: opts.startHousing ?? null,
    timeLeft: 0,
    travelMultiplier: 1,
  };
  return {
    players: [player],
    current: 0,
    week: 1,
    phase: "setup",
    economyIndex: CONFIG.indexStart,
    goals: { ...CONFIG.defaultGoals },
    seed: opts.seed,
    log: [],
  };
}
