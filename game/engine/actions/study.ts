// game/engine/actions/study.ts
import type { GameState } from "../state";
import type { World } from "../world";
import { type ApplyResult, ok, reject, updateCurrent } from "../result";
import { buildingAt, hasService } from "../../data/buildings";
import { CONFIG } from "../../data/config";

export interface StudyAction {
  type: "study";
}

export function study(state: GameState, _action: StudyAction, world: World): ApplyResult {
  if (state.phase !== "playing") return reject(state, "Can only study while playing.");
  const p = state.players[state.current];
  if (!p.enrolledCourse) return reject(state, "You're not enrolled in a course. Enroll first.");
  const here = buildingAt(world.buildings, p.position);
  if (!here || !hasService(here, "education")) return reject(state, "Study at the University.");
  const course = world.courses[p.enrolledCourse];
  if (!course) return reject(state, `Unknown course: ${p.enrolledCourse}`);
  if (course.timeCost > p.timeLeft) return reject(state, "Not enough time to study.");

  const sessions = CONFIG.studySessionsToGraduate;
  const newProgress = p.courseProgress + 1;
  // Telescoping per-session gain so the total equals course.educationGain at graduation.
  const gained =
    Math.round((course.educationGain * newProgress) / sessions) -
    Math.round((course.educationGain * p.courseProgress) / sessions);
  const graduating = newProgress >= sessions;

  return ok(
    updateCurrent(state, (pl) => ({
      ...pl,
      education: pl.education + gained,
      timeLeft: pl.timeLeft - course.timeCost,
      enrolledCourse: graduating ? null : pl.enrolledCourse,
      courseProgress: graduating ? 0 : newProgress,
    })),
  );
}
