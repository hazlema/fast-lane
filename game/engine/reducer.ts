// game/engine/reducer.ts
import type { GameState, Player, Stat } from "./state";
import { CONFIG } from "../data/config";
import { type BoardGraph, type NodeId } from "../data/board";
import { travelCost } from "./movement";

export type Action =
  | { type: "setGoals"; goals: Record<Stat, number> }
  | { type: "moveTo"; node: NodeId };
// Economy actions (work, buy, bank, rent, takeClass, applyForJob, endWeek) arrive in Plan 2.

export interface ApplyResult {
  state: GameState;
  ok: boolean;
  reason?: string;
}

function reject(state: GameState, reason: string): ApplyResult {
  return { state, ok: false, reason };
}

// Immutably replace the current player with the result of `fn`.
function updateCurrent(state: GameState, fn: (p: Player) => Player): GameState {
  const players = state.players.map((p, i) => (i === state.current ? fn(p) : p));
  return { ...state, players };
}

export function applyAction(state: GameState, action: Action, graph: BoardGraph): ApplyResult {
  switch (action.type) {
    case "setGoals": {
      if (state.phase !== "setup") {
        return reject(state, "Goals can only be set during setup.");
      }
      const started: GameState = {
        ...state,
        goals: { ...action.goals },
        phase: "playing",
      };
      return {
        ok: true,
        state: updateCurrent(started, (p) => ({ ...p, timeLeft: CONFIG.weeklyTimeBudget })),
      };
    }

    case "moveTo": {
      if (state.phase !== "playing") {
        return reject(state, "Can only move while playing.");
      }
      if (!graph.nodes.includes(action.node)) {
        return reject(state, `Unknown node: ${action.node}`);
      }
      const player = state.players[state.current];
      const cost = travelCost(graph, player.position, action.node, player.travelMultiplier);
      if (cost > player.timeLeft) {
        return reject(state, "Not enough time to travel there.");
      }
      const next = updateCurrent(state, (p) => ({
        ...p,
        position: action.node,
        timeLeft: p.timeLeft - cost,
      }));
      return { ok: true, state: next };
    }
  }
}
