// game/engine/actions/buy.ts
import type { GameState, ItemId } from "../state";
import type { World } from "../world";
import { type ApplyResult, ok, reject, updateCurrent } from "../result";
import { buildingAt } from "../../data/buildings";

export interface BuyAction {
  type: "buy";
  item: ItemId;
}

export function buy(state: GameState, action: BuyAction, world: World): ApplyResult {
  if (state.phase !== "playing") return reject(state, "Can only shop while playing.");
  const player = state.players[state.current];
  const here = buildingAt(world.buildings, player.position);
  const shop = here?.services.find((s) => s.kind === "shop");
  if (!shop || shop.kind !== "shop") return reject(state, "No shop here.");
  if (!shop.itemIds.includes(action.item)) return reject(state, "That item is not sold here.");
  const item = world.items[action.item];
  if (!item) return reject(state, `Unknown item: ${action.item}`);
  if (item.cost > player.cash) return reject(state, "You can't afford that.");
  if (item.timeCost > player.timeLeft) return reject(state, "Not enough time to shop.");
  return ok(
    updateCurrent(state, (p) => ({
      ...p,
      cash: p.cash - item.cost,
      happiness: p.happiness + item.happinessGain,
      timeLeft: p.timeLeft - item.timeCost,
      inventory: [...p.inventory, action.item],
      ateThisWeek: item.food ? true : p.ateThisWeek, // a meal feeds you for the week
    })),
  );
}
