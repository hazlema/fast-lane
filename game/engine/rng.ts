// game/engine/rng.ts
// Deterministic PRNG (mulberry32). Same seed → same sequence, so tests are repeatable.
// NOTE: the seed is reduced to a 32-bit unsigned int via `>>> 0`, so seeds outside
// [0, 2^32) (e.g. Date.now()) are truncated. This is harmless for determinism/replay —
// the same stored seed always truncates identically — but two seeds that differ only
// above bit 32 will alias to the same sequence.
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
