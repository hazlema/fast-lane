// game/data/housing.ts
import type { HousingId } from "../engine/state";

export interface Housing {
  id: HousingId;
  name: string;
  monthlyRent: number; // charged once a month (× economy index)
}

export const HOUSING: Record<HousingId, Housing> = {
  lowcost:  { id: "lowcost",  name: "Low Cost Housing", monthlyRent: 40 },
  highsec:  { id: "highsec",  name: "High Security Apartments", monthlyRent: 120 },
};
