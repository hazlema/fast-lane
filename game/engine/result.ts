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

// Phase gate shared by every in-game action: returns a rejection to hand back,
// or null when the action may proceed. `verb` fills "Can only <verb> while playing."
export function requirePlaying(state: GameState, verb: string): ApplyResult | null {
  if (state.phase !== "playing") return reject(state, `Can only ${verb} while playing.`);
  return null;
}

// Immutably replace the current player with the result of `fn`.
export function updateCurrent(state: GameState, fn: (p: Player) => Player): GameState {
  const players = state.players.map((p, i) => (i === state.current ? fn(p) : p));
  return { ...state, players };
}
