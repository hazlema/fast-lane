// game/data/jobs.ts
import type { JobId } from "../engine/state";
import type { CourseId } from "./courses";

export interface Job {
  id: JobId;
  title: string;
  buildingId: string;            // where this job is worked (Building.id)
  wage: number;                  // base pay per work shift (before career bonus)
  timeCost: number;              // time units per shift
  requiredDegrees: CourseId[];   // degrees that must be completed to be hired (0-2)
  requiredExperience: number;    // min experience to be hired
  requiredDependability: number; // min dependability to be hired
}

export const JOBS: Record<JobId, Job> = {
  // Entry — always hireable.
  janitor:  { id: "janitor",  title: "Janitor",     buildingId: "factory",    wage: 80,  timeCost: 15, requiredDegrees: [], requiredExperience: 0, requiredDependability: 0 },
  // One degree.
  clerk:    { id: "clerk",    title: "Store Clerk", buildingId: "tryandsave", wage: 120, timeCost: 15, requiredDegrees: ["juniorcollege"], requiredExperience: 0, requiredDependability: 0 },
  // Two degrees — Trade track payoff.
  engineer: { id: "engineer", title: "Engineer",    buildingId: "factory",    wage: 220, timeCost: 20, requiredDegrees: ["engineering", "juniorcollege"], requiredExperience: 20, requiredDependability: 20 },
  // Two degrees — Business track payoff.
  broker:   { id: "broker",   title: "Broker",      buildingId: "tryandsave", wage: 220, timeCost: 20, requiredDegrees: ["busadmin", "academic"], requiredExperience: 25, requiredDependability: 25 },
};
