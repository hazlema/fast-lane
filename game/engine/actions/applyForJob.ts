// game/engine/actions/applyForJob.ts
import type { GameState, JobId, LogEntry } from "../state";
import type { World } from "../world";
import { type ApplyResult, ok, reject, updateCurrent } from "../result";
import { buildingAt } from "../../data/buildings";
import { isQualifiedFor, hasOpening, hasGoodWorkHistory } from "../checks";
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

  // Applying always costs the time. You're hired only if you (a) meet the
  // degree/experience/dependability bar AND (b) there's an opening. Apply for
  // something you're not qualified for and you simply don't get it — that's on
  // you. Even when qualified, a specialised job may have no opening this week
  // (entry jobs with no degree requirement always hire).
  const goodHistory = hasGoodWorkHistory(player);
  const qualified = isQualifiedFor(player, job);
  const hired = goodHistory && qualified && hasOpening(job, state.seed, state.week);

  const spent = updateCurrent(state, (p) => ({
    ...p,
    timeLeft: p.timeLeft - CONFIG.applyJobTimeCost,
    jobId: hired ? action.job : p.jobId,
  }));

  const text = hired
    ? `Hired as ${job.title}!`
    : !goodHistory
      ? `Rejected by ${job.title} — poor work history.`
      : !qualified
        ? `Applied for ${job.title} — not qualified, no offer.`
        : `Applied for ${job.title} — qualified, but no openings right now.`;
  const log: LogEntry[] = [...spent.log, { week: spent.week, text }];
  return ok({ ...spent, log });
}
