// tools/sim/tests/bot.test.ts
import { test, expect } from "bun:test";
import { decide } from "../bot";
import { newGame } from "../../../game/engine/loop";
import { applyAction } from "../../../game/engine/reducer";
import { WORLD } from "../../../game/data/world";
import type { Player } from "../../../game/engine/state";

function playing(over: Partial<Player> = {}) {
  let g = newGame({ playerName: "B", startNode: "lowcost", seed: 1, startHousing: "lowcost" });
  g = applyAction(g, { type: "setGoals", goals: g.goals }, WORLD).state; // → playing
  return { ...g, players: [{ ...g.players[0], ...over }] };
}

test("bot eats when hungry and standing at the food shop", () => {
  const g = playing({ ateThisWeek: false, mealsStocked: 0, cash: 100, position: "frosty" });
  expect(decide(g, WORLD)).toEqual({ type: "buy", item: "burger" });
});

test("bot heads to the food shop when hungry elsewhere", () => {
  const g = playing({ ateThisWeek: false, mealsStocked: 0, cash: 100, position: "bank" });
  expect(decide(g, WORLD)).toEqual({ type: "moveTo", node: "frosty" });
});

test("bot pays rent when it's due and it's standing at the office", () => {
  const g = playing({ ateThisWeek: true, mealsStocked: 1, rentDue: 100, cash: 200, position: "rentoffice" });
  expect(decide(g, WORLD)).toEqual({ type: "payRent" });
});

test("bot applies for work when unemployed", () => {
  const g = playing({ ateThisWeek: true, mealsStocked: 1, cash: 200, position: "employment" });
  const a = decide(g, WORLD);
  expect(a.type).toBe("applyForJob"); // some entry job it qualifies for
});
