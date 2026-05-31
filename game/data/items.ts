// game/data/items.ts
import type { ItemId } from "../engine/state";

export interface Item {
  id: ItemId;
  name: string;
  cost: number;
  timeCost: number;
  happinessGain: number; // 0 if the item gives no happiness
  clothing: boolean;     // true if it counts as clothing
}

export const ITEMS: Record<ItemId, Item> = {
  burger:   { id: "burger",   name: "Frosty Burger", cost: 8,   timeCost: 5,  happinessGain: 6,  clothing: false },
  tv:       { id: "tv",       name: "Television",    cost: 300, timeCost: 5,  happinessGain: 25, clothing: false },
  suit:     { id: "suit",     name: "Business Suit", cost: 200, timeCost: 5,  happinessGain: 5,  clothing: true },
};
