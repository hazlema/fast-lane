// game/engine/actions/rent.test.ts
import { test, expect } from "bun:test";
import { applyAction } from "../reducer";
import { createGame } from "../state";
import { TEST_WORLD } from "../../data/world";

function atRentOffice() {
  let g = createGame({ playerName: "Al", startNode: "n5", seed: 1 }); // rentoffice = n5
  g = applyAction(g, { type: "setGoals", goals: g.goals }, TEST_WORLD).state;
  return g;
}

test("renting sets weeklyRent and housingId", () => {
  const g = atRentOffice();
  const r = applyAction(g, { type: "rent", unit: "lowcost" }, TEST_WORLD);
  expect(r.ok).toBe(true);
  expect(r.state.players[0].housingId).toBe("lowcost");
  expect(r.state.players[0].weeklyRent).toBe(TEST_WORLD.housing.lowcost.weeklyRent);
});

test("renting an unlisted unit is rejected", () => {
  const g = atRentOffice();
  const r = applyAction(g, { type: "rent", unit: "mansion" }, TEST_WORLD);
  expect(r.ok).toBe(false);
  expect(r.reason).toMatch(/available|housing|unit/i);
});

test("renting away from a rent office is rejected", () => {
  let g = atRentOffice();
  g = { ...g, players: [{ ...g.players[0], position: "n4" }] }; // bank
  const r = applyAction(g, { type: "rent", unit: "lowcost" }, TEST_WORLD);
  expect(r.ok).toBe(false);
  expect(r.reason).toMatch(/housing|rent|here/i);
});
