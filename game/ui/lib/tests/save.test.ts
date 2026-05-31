// game/ui/lib/save.test.ts
import { test, expect } from "bun:test";
import { serialize, deserialize } from "../save";
import { createGame } from "../../../engine/state";

const sampleState = () => createGame({ playerName: "You", startNode: "tryandsave", seed: 7 });

test("serialize → deserialize round-trips state and screen", () => {
  const state = sampleState();
  const back = deserialize(serialize({ state, screen: "home" }));
  expect(back).not.toBeNull();
  expect(back!.screen).toBe("home");
  expect(back!.state.seed).toBe(7);
  expect(back!.state.players[0].position).toBe("tryandsave");
});

test("deserialize returns null for missing, garbage, or wrong-version data", () => {
  expect(deserialize(null)).toBeNull();
  expect(deserialize("not json")).toBeNull();
  expect(deserialize(JSON.stringify({ version: 999, state: sampleState(), screen: "home" }))).toBeNull();
});
