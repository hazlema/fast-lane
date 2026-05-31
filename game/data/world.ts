// game/data/world.ts
import type { World } from "../engine/world";
import type { BoardGraph } from "./board";
import { BOARD, testRing } from "./board";
import { BUILDINGS, TEST_BUILDINGS, type Building } from "./buildings";
import { JOBS } from "./jobs";
import { COURSES } from "./courses";
import { ITEMS } from "./items";
import { HOUSING } from "./housing";

// Assemble a World from a board graph + a building set, validating the wiring.
export function makeWorld(graph: BoardGraph, buildings: Building[]): World {
  for (const b of buildings) {
    if (!graph.nodes.includes(b.node)) {
      throw new Error(`Building ${b.id} wired to unknown node ${b.node}`);
    }
  }
  return { graph, buildings, jobs: JOBS, courses: COURSES, items: ITEMS, housing: HOUSING };
}

// The real game world (13-building board).
export const WORLD: World = makeWorld(BOARD, BUILDINGS);

// Controlled fixture for engine unit tests (testRing + the 6-building set).
export const TEST_WORLD: World = makeWorld(testRing, TEST_BUILDINGS);
