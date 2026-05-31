// game/engine/winCheck.ts
import type { GameState, Player, Stat } from "./state";

export function wealthOf(p: Player): number {
  return p.cash + p.bank - p.debt;
}

export function statValue(p: Player, stat: Stat): number {
  switch (stat) {
    case "wealth":
      return wealthOf(p);
    case "happiness":
      return p.happiness;
    case "education":
      return p.education;
    case "career":
      return p.careerLevel;
  }
}

export function hasWon(state: GameState, playerIndex: number): boolean {
  const p = state.players[playerIndex];
  const stats = Object.keys(state.goals) as Stat[];
  return stats.every((s) => statValue(p, s) >= state.goals[s]);
}
