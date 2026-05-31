// game/engine/actions/payRent.ts
import type { GameState } from "../state";
import type { World } from "../world";
import { type ApplyResult, ok, reject, updateCurrent } from "../result";
import { buildingAt } from "../../data/buildings";

export interface PayRentAction {
  type: "payRent";
}

export function payRent(state: GameState, _action: PayRentAction, world: World): ApplyResult {
  if (state.phase !== "playing") return reject(state, "Can only pay rent while playing.");
  const p = state.players[state.current];
  const here = buildingAt(world.buildings, p.position);
  const housing = here?.services.find((s) => s.kind === "housing");
  if (!housing) return reject(state, "Pay rent at the Rent Office.");
  if (p.rentDue <= 0) return reject(state, "No rent is due.");
  const pay = Math.min(p.rentDue, p.cash);
  if (pay <= 0) return reject(state, "Not enough cash to pay rent.");
  return ok(updateCurrent(state, (pl) => ({ ...pl, cash: pl.cash - pay, rentDue: pl.rentDue - pay })));
}
