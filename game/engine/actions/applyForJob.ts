// game/engine/actions/applyForJob.ts
import type { GameState, JobId } from "../state";
import type { World } from "../world";
import { type ApplyResult, ok, reject, updateCurrent } from "../result";
import { buildingAt } from "../../data/buildings";
import { CONFIG } from "../../data/config";

export interface ApplyForJobAction {
  type: "applyForJob";
  job: JobId;
}

export function applyForJob(state: GameState, action: ApplyForJobAction, world: World): ApplyResult {
  if (state.phase !== "playing") return reject(state, "Can only apply while playing.");
  const player = state.players[state.current];
  const here = buildingAt(world.buildings, player.position);
  const hiring = here?.services.find((s) => s.kind === "hiring");
  if (!hiring || hiring.kind !== "hiring") {
    return reject(state, "No hiring office here.");
  }
  if (!hiring.jobIds.includes(action.job)) {
    return reject(state, "That job is not offered here.");
  }
  const job = world.jobs[action.job];
  if (!job) return reject(state, `Unknown job: ${action.job}`);
  const missingDegree = job.requiredDegrees.find((d) => !player.completedCourses.includes(d));
  if (missingDegree) {
    return reject(state, `Requires the ${world.courses[missingDegree]?.name ?? missingDegree} degree.`);
  }
  if (player.experience < job.requiredExperience) {
    return reject(state, "You need more experience for that job.");
  }
  if (player.dependability < job.requiredDependability) {
    return reject(state, "You need a better dependability record for that job.");
  }
  if (CONFIG.applyJobTimeCost > player.timeLeft) {
    return reject(state, "Not enough time to apply.");
  }
  return ok(
    updateCurrent(state, (p) => ({
      ...p,
      jobId: action.job,
      timeLeft: p.timeLeft - CONFIG.applyJobTimeCost,
    })),
  );
}
