// game/data/jobs.ts
import type { JobId } from "../engine/state";

export interface Job {
  id: JobId;
  title: string;
  buildingId: string;        // where this job is worked (Building.id)
  wage: number;              // base pay per work shift (before career bonus)
  timeCost: number;          // time units per shift
  requiredEducation: number; // min education to be hired
}

export const JOBS: Record<JobId, Job> = {
  janitor: { id: "janitor", title: "Janitor", buildingId: "factory", wage: 80, timeCost: 15, requiredEducation: 0 },
  clerk:   { id: "clerk",   title: "Store Clerk", buildingId: "tryandsave", wage: 120, timeCost: 15, requiredEducation: 20 },
  engineer:{ id: "engineer",title: "Engineer", buildingId: "factory", wage: 220, timeCost: 20, requiredEducation: 60 },
};
