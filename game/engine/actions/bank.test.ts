// game/engine/actions/bank.test.ts
import { test, expect } from "bun:test";
import { applyAction } from "../reducer";
import { createGame } from "../state";
import { WORLD } from "../../data/world";

function atBank(over: Partial<ReturnType<typeof createGame>["players"][number]> = {}) {
  let g = createGame({ playerName: "Al", startNode: "n4", seed: 1 }); // bank = n4
  g = applyAction(g, { type: "setGoals", goals: g.goals }, WORLD).state;
  g = { ...g, players: [{ ...g.players[0], ...over }] };
  return g;
}

test("deposit moves cash into the bank", () => {
  const g = atBank({ cash: 500, bank: 0 });
  const r = applyAction(g, { type: "bank", op: "deposit", amount: 200 }, WORLD);
  expect(r.ok).toBe(true);
  expect(r.state.players[0].cash).toBe(300);
  expect(r.state.players[0].bank).toBe(200);
});

test("withdraw moves bank into cash", () => {
  const g = atBank({ cash: 0, bank: 200 });
  const r = applyAction(g, { type: "bank", op: "withdraw", amount: 150 }, WORLD);
  expect(r.ok).toBe(true);
  expect(r.state.players[0].cash).toBe(150);
  expect(r.state.players[0].bank).toBe(50);
});

test("loan increases both cash and debt", () => {
  const g = atBank({ cash: 100, debt: 0 });
  const r = applyAction(g, { type: "bank", op: "loan", amount: 500 }, WORLD);
  expect(r.ok).toBe(true);
  expect(r.state.players[0].cash).toBe(600);
  expect(r.state.players[0].debt).toBe(500);
});

test("repay reduces debt and cash by the same amount", () => {
  const g = atBank({ cash: 300, debt: 500 });
  const r = applyAction(g, { type: "bank", op: "repay", amount: 200 }, WORLD);
  expect(r.ok).toBe(true);
  expect(r.state.players[0].cash).toBe(100);
  expect(r.state.players[0].debt).toBe(300);
});

test("deposit is rejected without enough cash", () => {
  const g = atBank({ cash: 50 });
  const r = applyAction(g, { type: "bank", op: "deposit", amount: 200 }, WORLD);
  expect(r.ok).toBe(false);
  expect(r.reason).toMatch(/cash|funds/i);
});

test("repay cannot exceed debt or cash", () => {
  const g = atBank({ cash: 100, debt: 40 });
  const r = applyAction(g, { type: "bank", op: "repay", amount: 999 }, WORLD);
  expect(r.ok).toBe(false);
  expect(r.reason).toMatch(/debt|cash|too much/i);
});

test("repay is rejected when it exceeds available cash", () => {
  // amount is within the debt (100 <= 500) but more cash than on hand (100 > 30)
  const g = atBank({ cash: 30, debt: 500 });
  const r = applyAction(g, { type: "bank", op: "repay", amount: 100 }, WORLD);
  expect(r.ok).toBe(false);
  expect(r.reason).toMatch(/cash/i);
});

test("non-positive amounts are rejected", () => {
  const g = atBank({ cash: 100 });
  const r = applyAction(g, { type: "bank", op: "deposit", amount: 0 }, WORLD);
  expect(r.ok).toBe(false);
  expect(r.reason).toMatch(/amount|positive/i);
});

test("banking is rejected away from a bank", () => {
  let g = atBank({ cash: 100 });
  g = { ...g, players: [{ ...g.players[0], position: "n3" }] }; // university
  const r = applyAction(g, { type: "bank", op: "deposit", amount: 50 }, WORLD);
  expect(r.ok).toBe(false);
  expect(r.reason).toMatch(/bank|here/i);
});
