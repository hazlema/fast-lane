// game/data/world.ts
import type { World } from "../engine/world";
import type { BoardGraph } from "./board";
import { testRing } from "./board";
import { BUILDINGS } from "./buildings";
import { JOBS } from "./jobs";
import { COURSES } from "./courses";
import { ITEMS } from "./items";
import { HOUSING } from "./housing";

// Assemble a World from a board graph + the data tables.
export function makeWorld(graph: BoardGraph): World {
  return { graph, buildings: BUILDINGS, jobs: JOBS, courses: COURSES, items: ITEMS, housing: HOUSING };
}

// Default world used by tests and (until waypoints land) the app: tables on testRing.
export const WORLD: World = makeWorld(testRing);
