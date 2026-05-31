// game/engine/actions/payRent.test.ts
import { test, expect } from "bun:test";
import { applyAction } from "../../reducer";
import { createGame } from "../../state";
import { TEST_WORLD } from "../../../data/world";

function atRentOffice(over = {}) {
  let g = createGame({ playerName: "Al", startNode: "n5", seed: 1 }); // rentoffice = n5
  g = applyAction(g, { type: "setGoals", goals: g.goals }, TEST_WORLD).state;
  g = { ...g, players: [{ ...g.players[0], ...over }] };
  return g;
}

test("payRent pays the full due amount from cash", () => {
  const g = atRentOffice({ cash: 200, rentDue: 40 });
  const r = applyAction(g, { type: "payRent" }, TEST_WORLD);
  expect(r.ok).toBe(true);
  expect(r.state.players[0].cash).toBe(160);
  expect(r.state.players[0].rentDue).toBe(0);
});

test("payRent makes a partial payment when cash is short", () => {
  const g = atRentOffice({ cash: 30, rentDue: 100 });
  const r = applyAction(g, { type: "payRent" }, TEST_WORLD);
  expect(r.ok).toBe(true);
  expect(r.state.players[0].cash).toBe(0);
  expect(r.state.players[0].rentDue).toBe(70);
});

test("payRent is rejected with nothing due", () => {
  const g = atRentOffice({ cash: 100, rentDue: 0 });
  const r = applyAction(g, { type: "payRent" }, TEST_WORLD);
  expect(r.ok).toBe(false);
  expect(r.reason).toMatch(/due/i);
});

test("payRent is rejected away from a rent office", () => {
  const g = atRentOffice({ cash: 100, rentDue: 40 });
  const moved = { ...g, players: [{ ...g.players[0], position: "n4" }] }; // bank
  const r = applyAction(moved, { type: "payRent" }, TEST_WORLD);
  expect(r.ok).toBe(false);
  expect(r.reason).toMatch(/rent office/i);
});
