// game/engine/movement.ts
import { hopsBetween, type BoardGraph, type NodeId } from "../data/board";
import { CONFIG } from "../data/config";

// Travel time in whole time units. Multiplier < 1 = faster (e.g. vehicle perk).
export function travelCost(
  graph: BoardGraph,
  from: NodeId,
  to: NodeId,
  travelMultiplier = 1,
): number {
  const hops = hopsBetween(graph, from, to);
  return Math.ceil(hops * CONFIG.hopCost * travelMultiplier);
}
