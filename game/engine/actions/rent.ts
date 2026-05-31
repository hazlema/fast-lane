// game/engine/actions/rent.ts
import type { GameState, HousingId } from "../state";
import type { World } from "../world";
import { type ApplyResult, ok, reject, updateCurrent } from "../result";
import { buildingAt } from "../../data/buildings";

export interface RentAction {
  type: "rent";
  unit: HousingId;
}

export function rent(state: GameState, action: RentAction, world: World): ApplyResult {
  if (state.phase !== "playing") return reject(state, "Can only rent while playing.");
  const player = state.players[state.current];
  const here = buildingAt(world.buildings, player.position);
  const housing = here?.services.find((s) => s.kind === "housing");
  if (!housing || housing.kind !== "housing") return reject(state, "No rentals here.");
  if (!housing.housingIds.includes(action.unit)) return reject(state, "That unit is not available here.");
  const unit = world.housing[action.unit];
  if (!unit) return reject(state, `Unknown housing: ${action.unit}`);
  return ok(updateCurrent(state, (p) => ({ ...p, housingId: action.unit })));
}
