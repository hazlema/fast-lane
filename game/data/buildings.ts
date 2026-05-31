// game/data/buildings.ts
import type { NodeId } from "./board";
import { testRing } from "./board";
import type { JobId } from "../engine/state";
import type { CourseId } from "./courses";
import type { ItemId } from "../engine/state";
import type { HousingId } from "../engine/state";

export type Service =
  | { kind: "workplace" }                       // jobs reference this building via Job.buildingId
  | { kind: "hiring"; jobIds: JobId[] }         // apply for these jobs here
  | { kind: "education"; courseIds: CourseId[] } // take these courses here
  | { kind: "shop"; itemIds: ItemId[] }         // buy these items here
  | { kind: "bank" }                            // deposit/withdraw/loan/repay
  | { kind: "housing"; housingIds: HousingId[] }; // rent these places here

export type ServiceKind = Service["kind"];

export interface Building {
  id: string;
  name: string;
  hitBoxId: string; // matches an SVG "Hit-Box" element (used by the UI in Plan 3)
  node: NodeId;
  services: Service[];
}

// Wired to testRing nodes for now (real waypoint nodes land with the SVG waypoint task).
export const BUILDINGS: Building[] = [
  {
    id: "factory", name: "Factory", hitBoxId: "Hit-Box18", node: "n0",
    services: [{ kind: "workplace" }],
  },
  {
    id: "tryandsave", name: "Try and Save", hitBoxId: "Hit-Box6", node: "n1",
    services: [{ kind: "workplace" }, { kind: "shop", itemIds: ["burger", "tv", "suit"] }],
  },
  {
    id: "employment", name: "Employment Office", hitBoxId: "Hit-Box20", node: "n2",
    services: [{ kind: "hiring", jobIds: ["janitor", "clerk", "engineer"] }],
  },
  {
    id: "university", name: "University", hitBoxId: "Hit-Box24", node: "n3",
    services: [{ kind: "education", courseIds: ["basics", "business", "engineering"] }],
  },
  {
    id: "bank", name: "Bank", hitBoxId: "Hit-Box4", node: "n4",
    services: [{ kind: "bank" }],
  },
  {
    id: "rentoffice", name: "Rent Office", hitBoxId: "Hit-Box16", node: "n5",
    services: [{ kind: "housing", housingIds: ["lowcost", "highsec"] }],
  },
];

// Defensive: ensure every building node exists on the ring (catches mis-wiring early).
for (const b of BUILDINGS) {
  if (!testRing.nodes.includes(b.node)) {
    throw new Error(`Building ${b.id} wired to unknown node ${b.node}`);
  }
}

export function buildingAt(buildings: Building[], node: NodeId): Building | undefined {
  return buildings.find((b) => b.node === node);
}

export function hasService(building: Building, kind: ServiceKind): boolean {
  return building.services.some((s) => s.kind === kind);
}
