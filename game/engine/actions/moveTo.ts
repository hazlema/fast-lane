// game/engine/actions/moveTo.ts
import type { GameState } from "../state";
import type { NodeId } from "../../data/board";
import type { World } from "../world";
import { type ApplyResult, ok, reject, updateCurrent, requirePlaying } from "../result";
import { travelCost } from "../movement";
import { ownsCar } from "../checks";

export interface MoveToAction {
  type: "moveTo";
  node: NodeId;
}

export function moveTo(state: GameState, action: MoveToAction, world: World): ApplyResult {
  const guard = requirePlaying(state, "move");
  if (guard) return guard;
  if (!world.graph.nodes.includes(action.node)) {
    return reject(state, `Unknown node: ${action.node}`);
  }
  const player = state.players[state.current];
  // A Tesla means free travel — every trip costs 0 time.
  const mult = ownsCar(player) ? 0 : player.travelMultiplier;
  const cost = travelCost(world.graph, player.position, action.node, mult);
  if (cost > player.timeLeft) {
    return reject(state, "Not enough time to travel there.");
  }
  return ok(updateCurrent(state, (p) => ({ ...p, position: action.node, timeLeft: p.timeLeft - cost })));
}
