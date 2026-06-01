// game/engine/market.ts
//
// The Discount Store's rotating weekly special (Mechanic 8). Each week a seeded
// one of the store's items goes on sale at a seeded percentage off — a reason
// to swing by and check. Pure given (seed, week, the store's item list); the
// UI and the buy action call it identically so the shown price always matches
// the charged price.
import type { ItemId } from "./state";
import { CONFIG } from "../data/config";
import { makeRng } from "./rng";

export interface Deal {
  item: ItemId;
  percent: number; // whole-number % off, e.g. 25
}

export function weeklyDeal(seed: number, week: number, itemIds: readonly ItemId[]): Deal | null {
  if (itemIds.length === 0) return null;
  const rng = makeRng(seed + week * 313 + 29);
  const item = itemIds[Math.floor(rng() * itemIds.length)];
  const percent = CONFIG.discountPercents[Math.floor(rng() * CONFIG.discountPercents.length)];
  return { item, percent };
}

export function salePrice(cost: number, percent: number): number {
  return Math.round(cost * (1 - percent / 100));
}
