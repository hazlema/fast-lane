// game/engine/economyIndex.ts
// The economy index drifts up and down via a seeded bounded random walk.
// Prices scale with it; wages scale inversely (see wages.ts).
import { CONFIG } from "../data/config";

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

// Given the current index and a seeded RNG, return next week's index.
export function nextIndex(current: number, rand: () => number): number {
  const step = (rand() * 2 - 1) * CONFIG.indexStepMax; // [-stepMax, +stepMax]
  return clamp(current + step, CONFIG.indexFloor, CONFIG.indexCeil);
}
