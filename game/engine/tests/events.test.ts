// game/engine/tests/events.test.ts
import { test, expect } from "bun:test";
import { rollWeekendEvent } from "../events";
import { createGame } from "../state";

const p = (over: Partial<ReturnType<typeof createGame>["players"][number]> = {}) => ({
  ...createGame({ playerName: "A", startNode: "n0", seed: 1 }).players[0],
  ...over,
});

test("rollWeekendEvent is deterministic for the same inputs", () => {
  expect(rollWeekendEvent(p({ cash: 500 }), 7, 5)).toEqual(rollWeekendEvent(p({ cash: 500 }), 7, 5));
});

test("a High Security resident is never mugged", () => {
  for (let w = 1; w <= 300; w++) {
    const r = rollWeekendEvent(p({ cash: 500, housingId: "highsec" }), 7, w);
    if (r) expect(r.news).not.toMatch(/mugger/i);
  }
});

test("a player carrying no cash is never mugged", () => {
  for (let w = 1; w <= 300; w++) {
    const r = rollWeekendEvent(p({ cash: 0, housingId: "lowcost" }), 7, w);
    if (r) expect(r.news).not.toMatch(/mugger/i);
  }
});

test("every weekend event can occur for an eligible player", () => {
  const seen = new Set<string>();
  for (let w = 1; w <= 500; w++) {
    const r = rollWeekendEvent(p({ cash: 500, housingId: "lowcost" }), 7, w);
    if (!r) continue;
    if (/mugger/i.test(r.news)) seen.add("mugger");
    if (/concert/i.test(r.news)) seen.add("concert");
    if (/found \$/i.test(r.news)) seen.add("windfall");
  }
  expect(seen).toEqual(new Set(["mugger", "concert", "windfall"]));
});

test("the mugger cleans out ALL your un-banked cash", () => {
  let mugging = null as ReturnType<typeof rollWeekendEvent>;
  for (let w = 1; w <= 300 && !mugging; w++) {
    const r = rollWeekendEvent(p({ cash: 1000, housingId: "lowcost" }), 7, w);
    if (r && /mugger/i.test(r.news)) mugging = r;
  }
  expect(mugging).not.toBeNull();
  expect(mugging!.player.cash).toBe(0); // banked savings are safe; cash on hand is gone
});

test("a quiet weekend returns null", () => {
  // With chance 0.5, some weeks produce no event at all.
  let quiet = false;
  for (let w = 1; w <= 50 && !quiet; w++) {
    if (rollWeekendEvent(p({ cash: 500 }), 7, w) === null) quiet = true;
  }
  expect(quiet).toBe(true);
});
