// game/engine/actions/enroll.ts
import type { GameState } from "../state";
import type { CourseId } from "../../data/courses";
import type { World } from "../world";
import { type ApplyResult, ok, reject, updateCurrent, requirePlaying } from "../result";
import { buildingAt } from "../../data/buildings";
import { canAfford } from "../checks";

export interface EnrollAction {
  type: "enroll";
  course: CourseId;
}

export function enroll(state: GameState, action: EnrollAction, world: World): ApplyResult {
  const guard = requirePlaying(state, "enroll");
  if (guard) return guard;
  const p = state.players[state.current];
  if (p.enrolledCourse) return reject(state, "You're already enrolled in a course.");
  const here = buildingAt(world.buildings, p.position);
  const edu = here?.services.find((s) => s.kind === "education");
  if (!edu || edu.kind !== "education") return reject(state, "No classes offered here.");
  if (!edu.courseIds.includes(action.course)) return reject(state, "That course is not offered here.");
  const course = world.courses[action.course];
  if (!course) return reject(state, `Unknown course: ${action.course}`);
  if (p.completedCourses.includes(action.course)) return reject(state, `You've already earned the ${course.name} degree.`);
  const missing = course.requires.find((r) => !p.completedCourses.includes(r));
  if (missing) return reject(state, `Requires the ${world.courses[missing]?.name ?? missing} degree first.`);
  if (!canAfford(p, course.cost)) return reject(state, "You can't afford the tuition.");
  return ok(updateCurrent(state, (pl) => ({ ...pl, cash: pl.cash - course.cost, enrolledCourse: action.course, courseProgress: 0 })));
}
