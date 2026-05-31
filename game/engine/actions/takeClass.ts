// game/engine/actions/takeClass.ts
import type { GameState } from "../state";
import type { CourseId } from "../../data/courses";
import type { World } from "../world";
import { type ApplyResult, ok, reject, updateCurrent } from "../result";
import { buildingAt } from "../../data/buildings";

export interface TakeClassAction {
  type: "takeClass";
  course: CourseId;
}

export function takeClass(state: GameState, action: TakeClassAction, world: World): ApplyResult {
  if (state.phase !== "playing") return reject(state, "Can only study while playing.");
  const player = state.players[state.current];
  const here = buildingAt(world.buildings, player.position);
  const edu = here?.services.find((s) => s.kind === "education");
  if (!edu || edu.kind !== "education") return reject(state, "No classes offered here.");
  if (!edu.courseIds.includes(action.course)) return reject(state, "That course is not offered here.");
  const course = world.courses[action.course];
  if (!course) return reject(state, `Unknown course: ${action.course}`);
  if (course.cost > player.cash) return reject(state, "You can't afford that course.");
  if (course.timeCost > player.timeLeft) return reject(state, "Not enough time for that class.");
  return ok(
    updateCurrent(state, (p) => ({
      ...p,
      cash: p.cash - course.cost,
      education: p.education + course.educationGain,
      timeLeft: p.timeLeft - course.timeCost,
    })),
  );
}
