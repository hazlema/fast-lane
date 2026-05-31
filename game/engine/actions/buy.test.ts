// game/engine/actions/buy.test.ts
import { test, expect } from "bun:test";
import { applyAction } from "../reducer";
import { createGame } from "../state";
import { TEST_WORLD } from "../../data/world";

function atShop(cash = 1000) {
  let g = createGame({ playerName: "Al", startNode: "n1", seed: 1 }); // tryandsave = n1, has shop
  g = applyAction(g, { type: "setGoals", goals: g.goals }, TEST_WORLD).state;
  g = { ...g, players: [{ ...g.players[0], cash }] };
  return g;
}

test("buying adds the item, raises happiness, costs cash and time", () => {
  const g = atShop();
  const before = g.players[0];
  const item = TEST_WORLD.items.burger;
  const r = applyAction(g, { type: "buy", item: "burger" }, TEST_WORLD);
  expect(r.ok).toBe(true);
  const p = r.state.players[0];
  expect(p.inventory).toContain("burger");
  expect(p.happiness).toBe(before.happiness + item.happinessGain);
  expect(p.cash).toBe(before.cash - item.cost);
  expect(p.timeLeft).toBe(before.timeLeft - item.timeCost);
});

test("buying food counts as eating this week; non-food doesn't", () => {
  let g = atShop();
  // Start the week not yet fed.
  g = { ...g, players: [{ ...g.players[0], ateThisWeek: false }] };
  const afterTv = applyAction(g, { type: "buy", item: "suit" }, TEST_WORLD); // suit isn't food
  expect(afterTv.state.players[0].ateThisWeek).toBe(false);
  const afterBurger = applyAction(g, { type: "buy", item: "burger" }, TEST_WORLD); // burger is food
  expect(afterBurger.state.players[0].ateThisWeek).toBe(true);
});

test("buying is rejected without enough cash", () => {
  const g = atShop(5); // tv costs 300
  const r = applyAction(g, { type: "buy", item: "tv" }, TEST_WORLD);
  expect(r.ok).toBe(false);
  expect(r.reason).toMatch(/cash|afford|money/i);
});

test("buying is rejected away from a shop", () => {
  let g = atShop();
  g = { ...g, players: [{ ...g.players[0], position: "n4" }] }; // bank
  const r = applyAction(g, { type: "buy", item: "burger" }, TEST_WORLD);
  expect(r.ok).toBe(false);
  expect(r.reason).toMatch(/shop|sell|here/i);
});

test("buying is rejected without enough time", () => {
  let g = atShop();
  g = { ...g, players: [{ ...g.players[0], timeLeft: 0 }] }; // buying costs 1 time
  const r = applyAction(g, { type: "buy", item: "burger" }, TEST_WORLD);
  expect(r.ok).toBe(false);
  expect(r.reason).toMatch(/time/i);
});
