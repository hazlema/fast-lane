// game/data/items.ts
import type { ItemId } from "../engine/state";

export interface Item {
  id: ItemId;
  name: string;
  cost: number;
  timeCost: number;
  happinessGain: number; // 0 if the item gives no happiness
  clothing: boolean;     // true if it counts as clothing (wearing it resets clothing wear)
  food: boolean;         // true if eating it counts as THIS week's meal right away
  meals: number;         // frozen meals it stocks (cooked one-a-week automatically); 0 if none
  lottery: boolean;      // true if buying it enters next turn's lottery draw
}

export const ITEMS: Record<ItemId, Item> = {
  burger:    { id: "burger",    name: "Frosty Burger",        cost: 8,   timeCost: 1, happinessGain: 6,  clothing: false, food: true,  meals: 0, lottery: false },
  burger8:   { id: "burger8",   name: "Frozen Burger 8-Pack", cost: 40,  timeCost: 1, happinessGain: 0,  clothing: false, food: false, meals: 8, lottery: false },
  newspaper: { id: "newspaper", name: "Daily Newspaper",      cost: 1,   timeCost: 1, happinessGain: 2,  clothing: false, food: false, meals: 0, lottery: false },
  lottery:   { id: "lottery",   name: "Lottery Ticket",       cost: 10,  timeCost: 1, happinessGain: 0,  clothing: false, food: false, meals: 0, lottery: true  },
  tv:        { id: "tv",        name: "Television",           cost: 300, timeCost: 1, happinessGain: 25, clothing: false, food: false, meals: 0, lottery: false },
  suit:      { id: "suit",      name: "Business Suit",        cost: 200, timeCost: 1, happinessGain: 5,  clothing: true,  food: false, meals: 0, lottery: false },
  casual:    { id: "casual",    name: "Casual Clothes",       cost: 80,  timeCost: 1, happinessGain: 1,  clothing: true,  food: false, meals: 0, lottery: false },
};

// Flavor headlines printed when you buy a newspaper. Pure fun.
export const HEADLINES: string[] = [
  "New species found: Raptor Cats!",
  "Local man eats 50 frozen burgers, feels 'fine'.",
  "Economy does a thing — experts baffled.",
  "Lottery winner buys entire Discount Store.",
  "University study finds: studying causes learning.",
  "Mayor declares every day Casual Friday.",
  "Factory robot demands raise, coffee break.",
  "Pawn shop owner pawns own shop.",
  "Scientists confirm: rent still too high.",
  "Bank teller smiles; customers concerned.",
];
