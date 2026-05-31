// game/engine/state.ts
import type { NodeId } from "../data/board";
import { CONFIG } from "../data/config";

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
  inventory: ItemId[];
  rentDue: number;             // accrued unpaid rent (paid at the Rent Office)
  housingId: HousingId | null; // current rented place
  timeLeft: number;
  travelMultiplier: number;
}

export interface LogEntry {
  week: number;
  text: string;
}

// "weekEnd" has no setter yet — reserved for Plan 3 (UI settlement animation).
export type Phase = "setup" | "playing" | "weekEnd" | "won";

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
    inventory: [],
    rentDue: 0,
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
