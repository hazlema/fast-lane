// game/data/jobs.ts
import type { JobId } from "../engine/state";
import type { CourseId } from "./courses";

export interface Job {
  id: JobId;
  title: string;
  buildingId: string;            // where this job is worked (Building.id)
  wage: number;                  // base pay per work shift (before career bonus / economy index)
  timeCost: number;              // time units per shift
  requiredDegrees: CourseId[];   // degrees that must be completed to be hired (0-2)
  requiredExperience: number;    // min experience to be hired
  requiredDependability: number; // min dependability to be hired
}

// Every business in town hires. The Employment Office lists them all; you apply
// for any of them (and may burn your time on jobs you don't qualify for).
export const JOBS: Record<JobId, Job> = {
  // Entry-level — no degree, always an opening.
  cook:       { id: "cook",       title: "Fry Cook",      buildingId: "frosty",     wage: 60,  timeCost: 1, requiredDegrees: [], requiredExperience: 0, requiredDependability: 0 },
  janitor:    { id: "janitor",    title: "Janitor",       buildingId: "factory",    wage: 80,  timeCost: 1, requiredDegrees: [], requiredExperience: 0, requiredDependability: 0 },
  cashier:    { id: "cashier",    title: "Cashier",       buildingId: "discount",   wage: 70,  timeCost: 1, requiredDegrees: [], requiredExperience: 0, requiredDependability: 0 },
  // One degree.
  clerk:      { id: "clerk",      title: "Store Clerk",   buildingId: "tryandsave", wage: 120, timeCost: 1, requiredDegrees: ["juniorcollege"], requiredExperience: 0,  requiredDependability: 0 },
  agent:      { id: "agent",      title: "Rental Agent",  buildingId: "rentoffice", wage: 120, timeCost: 1, requiredDegrees: ["juniorcollege"], requiredExperience: 0,  requiredDependability: 0 },
  teller:     { id: "teller",     title: "Bank Teller",   buildingId: "bank",       wage: 140, timeCost: 1, requiredDegrees: ["juniorcollege"], requiredExperience: 10, requiredDependability: 10 },
  pawnbroker: { id: "pawnbroker", title: "Pawnbroker",    buildingId: "pawn",       wage: 130, timeCost: 1, requiredDegrees: ["juniorcollege"], requiredExperience: 10, requiredDependability: 10 },
  tailor:     { id: "tailor",     title: "Tailor",        buildingId: "offrack",    wage: 140, timeCost: 1, requiredDegrees: ["tradeschool"],   requiredExperience: 10, requiredDependability: 10 },
  technician: { id: "technician", title: "Technician",    buildingId: "electronics",wage: 160, timeCost: 1, requiredDegrees: ["tradeschool"],   requiredExperience: 15, requiredDependability: 15 },
  professor:  { id: "professor",  title: "Professor",     buildingId: "university",  wage: 190, timeCost: 1, requiredDegrees: ["academic"],      requiredExperience: 20, requiredDependability: 20 },
  manager:    { id: "manager",    title: "Store Manager", buildingId: "tryandsave", wage: 200, timeCost: 1, requiredDegrees: ["busadmin"],      requiredExperience: 20, requiredDependability: 20 },
  // Two degrees — the top of each track.
  engineer:   { id: "engineer",   title: "Engineer",      buildingId: "factory",    wage: 230, timeCost: 1, requiredDegrees: ["engineering", "juniorcollege"], requiredExperience: 25, requiredDependability: 25 },
  broker:     { id: "broker",     title: "Broker",        buildingId: "bank",       wage: 240, timeCost: 1, requiredDegrees: ["busadmin", "academic"],         requiredExperience: 30, requiredDependability: 30 },
};
