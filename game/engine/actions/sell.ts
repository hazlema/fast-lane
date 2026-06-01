// game/engine/actions/sell.ts
import type { GameState, ItemId } from "../state";
import type { World } from "../world";
import { type ApplyResult, ok, reject, updateCurrent, requirePlaying } from "../result";
import { buildingAt } from "../../data/buildings";
import { isPawnable } from "../checks";
import { CONFIG } from "../../data/config";

export interface SellAction {
  type: "sell";
  item: ItemId;
}

// Pawn a durable good for a fraction of its cost — quick cash when you're stuck.
export function sell(state: GameState, action: SellAction, world: World): ApplyResult {
  const guard = requirePlaying(state, "sell");
  if (guard) return guard;
  const player = state.players[state.current];
  const here = buildingAt(world.buildings, player.position);
  if (!here?.services.some((s) => s.kind === "pawn")) return reject(state, "No pawn shop here.");
  const idx = player.inventory.indexOf(action.item);
  if (idx === -1) return reject(state, "You don't have that to sell.");
  const item = world.items[action.item];
  if (!item) return reject(state, `Unknown item: ${action.item}`);
  if (!isPawnable(item)) return reject(state, "The pawn shop won't buy that.");
  if (player.timeLeft < 1) return reject(state, "Not enough time.");
  const refund = Math.round(item.cost * CONFIG.pawnSellFraction);
  return ok(updateCurrent(state, (p) => ({
    ...p,
    cash: p.cash + refund,
    timeLeft: p.timeLeft - 1,
    inventory: p.inventory.filter((_, i) => i !== idx),
  })));
}
