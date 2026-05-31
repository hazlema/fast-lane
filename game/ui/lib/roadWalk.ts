// game/ui/lib/roadWalk.ts
// Pure geometry for walking the player token along the board's Road path.
// DOM-free: the caller supplies a sampler (in the app,
// SVGPathElement.getPointAtLength) and the total path length, so this is
// unit-testable without a browser.

export interface Pt { x: number; y: number; }
export type Sampler = (len: number) => Pt;

// For each node, scan the path and record the offset whose sampled point is
// nearest to the node's screen coordinate. `samples` sets scan resolution.
export function nodeOffsets<K extends string>(
  nodeIds: K[],
  xy: Record<K, Pt>,
  sampleAt: Sampler,
  totalLength: number,
  samples = 720,
): Record<K, number> {
  const out = {} as Record<K, number>;
  for (const id of nodeIds) {
    const target = xy[id];
    let bestLen = 0;
    let bestD = Infinity;
    for (let s = 0; s <= samples; s++) {
      const len = (s / samples) * totalLength;
      const p = sampleAt(len);
      const dx = p.x - target.x;
      const dy = p.y - target.y;
      const d = dx * dx + dy * dy;
      if (d < bestD) { bestD = d; bestLen = len; }
    }
    out[id] = bestLen;
  }
  return out;
}

// Signed shortest delta from fromOff to toOff around a loop of `total` length.
// Result is in (-total/2, total/2]; add to fromOff (then wrap) to walk short.
export function shorterArc(fromOff: number, toOff: number, total: number): number {
  let d = (toOff - fromOff) % total;
  if (d < 0) d += total;          // [0, total)
  if (d > total / 2) d -= total;  // shorter direction
  return d;
}

export function wrap(off: number, total: number): number {
  return ((off % total) + total) % total;
}
