// game/engine/actions/applyForJob.ts
import type { GameState, JobId, LogEntry } from "../state";
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
  // You must have the time to even attempt the application.
  if (CONFIG.applyJobTimeCost > player.timeLeft) {
    return reject(state, "Not enough time to apply.");
  }

  // Applying always costs the time. Whether you're hired depends on your
  // qualifications — apply for something you're not qualified for and you
  // simply don't get it (and you've spent the time). That's on you.
  const missingDegree = job.requiredDegrees.find((d) => !player.completedCourses.includes(d));
  const qualified =
    !missingDegree &&
    player.experience >= job.requiredExperience &&
    player.dependability >= job.requiredDependability;

  const spent = updateCurrent(state, (p) => ({
    ...p,
    timeLeft: p.timeLeft - CONFIG.applyJobTimeCost,
    jobId: qualified ? action.job : p.jobId,
  }));

  const text = qualified
    ? `Hired as ${job.title}!`
    : `Applied for ${job.title} — not qualified, no offer.`;
  const log: LogEntry[] = [...spent.log, { week: spent.week, text }];
  return ok({ ...spent, log });
}
