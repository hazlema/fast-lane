// game/engine/rng.ts
// Deterministic PRNG (mulberry32). Same seed → same sequence, so tests are repeatable.
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return function next(): number {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Inclusive on both ends.
export function randInt(next: () => number, minInclusive: number, maxInclusive: number): number {
  return minInclusive + Math.floor(next() * (maxInclusive - minInclusive + 1));
}
