// game/engine/actions/relax.ts
import type { GameState } from "../state";
import type { World } from "../world";
import { type ApplyResult, ok, reject, updateCurrent, requirePlaying } from "../result";
import { buildingAt } from "../../data/buildings";
import { CONFIG } from "../../data/config";

export interface RelaxAction {
  type: "relax";
}

// Unwind at home for a happiness lift; a TV makes the evening better.
export function relax(state: GameState, _action: RelaxAction, world: World): ApplyResult {
  const guard = requirePlaying(state, "relax");
  if (guard) return guard;
  const player = state.players[state.current];
  const here = buildingAt(world.buildings, player.position);
  if (!here?.services.some((s) => s.kind === "home")) return reject(state, "You can only relax at home.");
  if (here.id !== player.housingId) return reject(state, "You don't live here.");
  if (player.timeLeft < 1) return reject(state, "Not enough time to relax.");
  const hasTv = player.inventory.includes("tv") || player.inventory.includes("tv_used");
  const gain = CONFIG.relaxHappiness + (hasTv ? CONFIG.relaxTvBonus : 0);
  return ok(updateCurrent(state, (p) => ({
    ...p,
    happiness: p.happiness + gain,
    timeLeft: p.timeLeft - 1,
  })));
}
