// game/engine/actions/buy.ts
import type { GameState, ItemId } from "../state";
import type { World } from "../world";
import type { LogEntry } from "../state";
import { type ApplyResult, ok, reject, updateCurrent, requirePlaying } from "../result";
import { buildingAt } from "../../data/buildings";
import { canAfford, isDurable, canFinanceCar } from "../checks";
import { makeRng } from "../rng";
import { weeklyDeal, salePrice } from "../market";
import { HEADLINES } from "../../data/items";

export interface BuyAction {
  type: "buy";
  item: ItemId;
}

export function buy(state: GameState, action: BuyAction, world: World): ApplyResult {
  const guard = requirePlaying(state, "shop");
  if (guard) return guard;
  const player = state.players[state.current];
  const here = buildingAt(world.buildings, player.position);
  const shop = here?.services.find((s) => s.kind === "shop");
  if (!shop || shop.kind !== "shop") return reject(state, "No shop here.");
  if (!shop.itemIds.includes(action.item)) return reject(state, "That item is not sold here.");
  const item = world.items[action.item];
  if (!item) return reject(state, `Unknown item: ${action.item}`);
  if (isDurable(item) && player.inventory.includes(item.id)) return reject(state, "You already own one.");
  // A Tesla needs financing: proof of a steady, well-paying job (no burger flippers).
  if (item.id === "tesla" && !canFinanceCar(player, player.jobId ? world.jobs[player.jobId] : null)) {
    return reject(state, "The dealership needs proof of a steady, well-paying job to finance a Tesla.");
  }

  // Discount Store: this item may be this week's rotating special, at a % off.
  let price = item.cost;
  if (here!.services.some((s) => s.kind === "discount")) {
    const deal = weeklyDeal(state.seed, state.week, shop.itemIds);
    if (deal && deal.item === action.item) price = salePrice(item.cost, deal.percent);
  }

  if (!canAfford(player, price)) return reject(state, "You can't afford that.");
  if (item.timeCost > player.timeLeft) return reject(state, "Not enough time to shop.");
  const bought = updateCurrent(state, (p) => ({
    ...p,
    cash: p.cash - price,
    happiness: p.happiness + item.happinessGain,
    timeLeft: p.timeLeft - item.timeCost,
    inventory: [...p.inventory, action.item],
    ateThisWeek: item.food ? true : p.ateThisWeek,           // a fresh meal feeds you this week
    clothingWear: item.clothing ? 0 : p.clothingWear,        // new clothes are fresh
    mealsStocked: p.mealsStocked + item.meals,               // frozen packs add to the stock
    lotteryTicket: item.lottery ? true : p.lotteryTicket,    // a ticket rides on next turn's draw
  }));

  // A newspaper comes with a (pure-flavor) headline.
  if (item.id === "newspaper") {
    const headline = HEADLINES[Math.floor(makeRng(state.seed + state.week + player.inventory.length)() * HEADLINES.length)];
    const log: LogEntry[] = [...bought.log, { week: bought.week, text: `📰 ${headline}` }];
    return ok({ ...bought, log });
  }
  return ok(bought);
}
