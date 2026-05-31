// game/engine/state.test.ts
import { test, expect } from "bun:test";
import { createGame } from "./state";
import { CONFIG } from "../data/config";

test("createGame starts in setup phase at week 1", () => {
  const g = createGame({ playerName: "Al", startNode: "n0", seed: 1 });
  expect(g.phase).toBe("setup");
  expect(g.week).toBe(1);
  expect(g.current).toBe(0);
});

test("createGame seeds one player with starting money and no time yet", () => {
  const g = createGame({ playerName: "Al", startNode: "n0", seed: 1 });
  expect(g.players).toHaveLength(1);
  const p = g.players[0];
  expect(p.name).toBe("Al");
  expect(p.position).toBe("n0");
  expect(p.cash).toBe(CONFIG.startingCash);
  expect(p.bank).toBe(CONFIG.startingBank);
  expect(p.debt).toBe(0);
  expect(p.happiness).toBe(0);
  expect(p.education).toBe(0);
  expect(p.careerLevel).toBe(0);
  expect(p.jobId).toBeNull();
  expect(p.travelMultiplier).toBe(1);
  expect(p.timeLeft).toBe(0); // time is granted when goals are set (week begins)
  expect(p.housingId).toBeNull();
  expect(p.rentDue).toBe(0);
  expect(g.economyIndex).toBe(CONFIG.indexStart);
});

test("createGame uses default goals", () => {
  const g = createGame({ playerName: "Al", startNode: "n0", seed: 1 });
  expect(g.goals).toEqual({ ...CONFIG.defaultGoals });
});

test("createGame can start the player already renting a unit", () => {
  const g = createGame({ playerName: "Al", startNode: "n0", seed: 1, startHousing: "lowcost" });
  expect(g.players[0].housingId).toBe("lowcost");
});
