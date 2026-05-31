// game/data/housing.ts
import type { HousingId } from "../engine/state";

export interface Housing {
  id: HousingId;
  name: string;
  weeklyRent: number;
}

export const HOUSING: Record<HousingId, Housing> = {
  lowcost:  { id: "lowcost",  name: "Low Cost Housing", weeklyRent: 40 },
  highsec:  { id: "highsec",  name: "High Security Apartments", weeklyRent: 120 },
};
