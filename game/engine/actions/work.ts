// game/engine/actions/work.ts
import type { GameState } from "../state";
import type { World } from "../world";
import { type ApplyResult, ok, reject, updateCurrent } from "../result";
import { buildingAt } from "../../data/buildings";
import { wageFor } from "../wages";

export interface WorkAction {
  type: "work";
}

export function work(state: GameState, _action: WorkAction, world: World): ApplyResult {
  if (state.phase !== "playing") return reject(state, "Can only work while playing.");
  const player = state.players[state.current];
  if (!player.jobId) return reject(state, "You have no job.");
  const job = world.jobs[player.jobId];
  if (!job) return reject(state, `Unknown job: ${player.jobId}`);
  const here = buildingAt(world.buildings, player.position);
  if (!here || here.id !== job.buildingId) {
    return reject(state, "You must be at your workplace to work.");
  }
  if (job.timeCost > player.timeLeft) return reject(state, "Not enough time to work a shift.");
  const pay = wageFor(job, player.careerLevel, state.economyIndex);
  return ok(
    updateCurrent(state, (p) => ({
      ...p,
      cash: p.cash + pay,
      timeLeft: p.timeLeft - job.timeCost,
      experience: p.experience + 1,
    })),
  );
}
