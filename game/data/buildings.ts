// game/data/buildings.ts
import type { NodeId } from "./board";
import type { JobId } from "../engine/state";
import type { CourseId } from "./courses";
import type { ItemId } from "../engine/state";
import type { HousingId } from "../engine/state";

export type Service =
  | { kind: "workplace" }                        // jobs reference this building via Job.buildingId
  | { kind: "hiring"; jobIds: JobId[] }          // apply for these jobs here
  | { kind: "education"; courseIds: CourseId[] }  // take these courses here
  | { kind: "shop"; itemIds: ItemId[] }          // buy these items here
  | { kind: "bank" }                             // deposit/withdraw/loan/repay
  | { kind: "housing"; housingIds: HousingId[] } // rent these places here
  | { kind: "pawn" }                             // sell inventory items back for cash
  | { kind: "home" }                             // your residence — relax here for happiness
  | { kind: "discount" };                        // runs a rotating weekly special on its shop items

export type ServiceKind = Service["kind"];

export interface Building {
  id: string;
  name: string;
  hitBoxId: string; // SVG group id the UI binds clicks to (Plan 4)
  node: NodeId;
  services: Service[];
}

// The real board: 13 buildings, one per ring node (node id === building id).
export const BUILDINGS: Building[] = [
  { id: "highsec", name: "High Security Apartments", hitBoxId: "High-Security", node: "highsec", services: [{ kind: "home" }] },
  { id: "rentoffice", name: "Rent Office", hitBoxId: "Rent-Office", node: "rentoffice",
    services: [{ kind: "housing", housingIds: ["lowcost", "highsec"] }, { kind: "workplace" }] },
  { id: "lowcost", name: "Low Cost Housing", hitBoxId: "Low-Cost", node: "lowcost", services: [{ kind: "home" }] },
  { id: "pawn", name: "Pawn Shop", hitBoxId: "Pawn-Shop", node: "pawn",
    services: [{ kind: "shop", itemIds: ["tv_used"] }, { kind: "pawn" }, { kind: "workplace" }] },
  { id: "discount", name: "Discount Store", hitBoxId: "Discount-Store", node: "discount",
    services: [{ kind: "discount" }, { kind: "shop", itemIds: ["tv", "stereo", "suit", "casual"] }, { kind: "workplace" }] },
  { id: "frosty", name: "Frosty Burger", hitBoxId: "Frosty-Burger", node: "frosty",
    services: [{ kind: "shop", itemIds: ["burger"] }, { kind: "workplace" }] },
  { id: "offrack", name: "Off the Rack", hitBoxId: "Off-the-Rack", node: "offrack",
    services: [{ kind: "shop", itemIds: ["casual", "suit"] }, { kind: "workplace" }] },
  { id: "electronics", name: "Electronics", hitBoxId: "Electronics", node: "electronics",
    services: [{ kind: "shop", itemIds: ["tv", "stereo", "fridge", "computer"] }, { kind: "workplace" }] },
  { id: "university", name: "University", hitBoxId: "University", node: "university",
    services: [{ kind: "education", courseIds: ["juniorcollege", "tradeschool", "busadmin", "academic", "preeng", "engineering"] }, { kind: "workplace" }] },
  { id: "employment", name: "Employment Office", hitBoxId: "Employment-Office", node: "employment",
    services: [{ kind: "hiring", jobIds: ["cook", "janitor", "cashier", "clerk", "agent", "teller", "pawnbroker", "tailor", "technician", "professor", "manager", "engineer", "broker"] }] },
  { id: "factory", name: "Factory", hitBoxId: "Factory", node: "factory",
    services: [{ kind: "workplace" }] },
  { id: "bank", name: "Bank", hitBoxId: "Bank", node: "bank",
    services: [{ kind: "bank" }, { kind: "workplace" }] },
  { id: "tryandsave", name: "Try and Save", hitBoxId: "Try-and-Save", node: "tryandsave",
    services: [{ kind: "workplace" }, { kind: "shop", itemIds: ["burger8", "newspaper", "lottery"] }] },
  { id: "dealership", name: "Tesla Dealership", hitBoxId: "Tesla-Dealership", node: "dealership",
    services: [{ kind: "shop", itemIds: ["tesla"] }] },
];

// Small fixture wired to testRing (n0..n5) for engine unit tests.
export const TEST_BUILDINGS: Building[] = [
  { id: "factory", name: "Factory", hitBoxId: "Hit-Box18", node: "n0", services: [{ kind: "workplace" }] },
  { id: "tryandsave", name: "Try and Save", hitBoxId: "Hit-Box6", node: "n1",
    services: [{ kind: "workplace" }, { kind: "shop", itemIds: ["burger", "tv", "suit"] }] },
  { id: "employment", name: "Employment Office", hitBoxId: "Hit-Box20", node: "n2",
    services: [{ kind: "hiring", jobIds: ["janitor", "clerk", "engineer", "broker"] }] },
  { id: "university", name: "University", hitBoxId: "Hit-Box24", node: "n3",
    services: [{ kind: "education", courseIds: ["juniorcollege", "tradeschool", "busadmin", "academic", "preeng", "engineering"] }] },
  { id: "bank", name: "Bank", hitBoxId: "Hit-Box4", node: "n4", services: [{ kind: "bank" }] },
  { id: "rentoffice", name: "Rent Office", hitBoxId: "Hit-Box16", node: "n5",
    services: [{ kind: "housing", housingIds: ["lowcost", "highsec"] }] },
];

export function buildingAt(buildings: Building[], node: NodeId): Building | undefined {
  return buildings.find((b) => b.node === node);
}

export function hasService(building: Building, kind: ServiceKind): boolean {
  return building.services.some((s) => s.kind === kind);
}
