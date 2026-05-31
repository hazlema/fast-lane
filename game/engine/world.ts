// game/engine/world.ts
import type { BoardGraph } from "../data/board";
import type { Building } from "../data/buildings";
import type { Job } from "../data/jobs";
import type { Course } from "../data/courses";
import type { Item } from "../data/items";
import type { Housing } from "../data/housing";
import type { JobId, ItemId, HousingId } from "./state";
import type { CourseId } from "../data/courses";

// Everything the reducer needs to know about the world, bundled into one arg.
export interface World {
  graph: BoardGraph;
  buildings: Building[];
  jobs: Record<JobId, Job>;
  courses: Record<CourseId, Course>;
  items: Record<ItemId, Item>;
  housing: Record<HousingId, Housing>;
}
