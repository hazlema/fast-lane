// game/engine/result.ts
import type { GameState, Player } from "./state";

export interface ApplyResult {
  state: GameState;
  ok: boolean;
  reason?: string;
}

export function ok(state: GameState): ApplyResult {
  return { state, ok: true };
}

export function reject(state: GameState, reason: string): ApplyResult {
  return { state, ok: false, reason };
}

// Immutably replace the current player with the result of `fn`.
export function updateCurrent(state: GameState, fn: (p: Player) => Player): GameState {
  const players = state.players.map((p, i) => (i === state.current ? fn(p) : p));
  return { ...state, players };
}
