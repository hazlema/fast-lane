// game/data/board.ts
// The board road is a single loop. Nodes are waypoints in ring order.
// (Real node data will be parsed from assets/board.svg in a later plan;
//  testRing is a hand-built stand-in so the engine is testable now.)
export type NodeId = string;

export interface BoardGraph {
  nodes: NodeId[]; // ordered ring; adjacency is implied by order (wraps around)
}

// Distance in waypoint hops, taking the shorter direction around the loop.
export function hopsBetween(graph: BoardGraph, a: NodeId, b: NodeId): number {
  const i = graph.nodes.indexOf(a);
  const j = graph.nodes.indexOf(b);
  if (i < 0) throw new Error(`unknown node: ${a}`);
  if (j < 0) throw new Error(`unknown node: ${b}`);
  const n = graph.nodes.length;
  const forward = (j - i + n) % n;
  const backward = (i - j + n) % n;
  return Math.min(forward, backward);
}

// Hand-built 8-node ring for tests and early engine work.
export const testRing: BoardGraph = {
  nodes: ["n0", "n1", "n2", "n3", "n4", "n5", "n6", "n7"],
};

// The real board: 13 waypoints from assets/board.svg, in clockwise ring order.
// Node ids equal building ids — every board space is exactly one building.
export const BOARD: BoardGraph = {
  nodes: [
    "highsec", "rentoffice", "lowcost", "pawn", "discount", "frosty", "offrack",
    "electronics", "university", "employment", "factory", "bank", "tryandsave",
  ],
};

// Board pixel size (matches the SVG viewBox) — used by the UI to place the token.
export const BOARD_SIZE = { width: 2300, height: 1850 } as const;

// The inclusive sequence of nodes from `from` to `to` along the shorter ring arc.
// Used by the UI to walk the token hop-by-hop.
export function ringPath(graph: BoardGraph, from: NodeId, to: NodeId): NodeId[] {
  const i = graph.nodes.indexOf(from);
  const j = graph.nodes.indexOf(to);
  if (i < 0) throw new Error(`unknown node: ${from}`);
  if (j < 0) throw new Error(`unknown node: ${to}`);
  const n = graph.nodes.length;
  const forward = (j - i + n) % n;
  const backward = (i - j + n) % n;
  const path: NodeId[] = [from];
  if (forward <= backward) {
    for (let k = 1; k <= forward; k++) path.push(graph.nodes[(i + k) % n]);
  } else {
    for (let k = 1; k <= backward; k++) path.push(graph.nodes[(i - k + n) % n]);
  }
  return path;
}

// Screen coordinate of each node's waypoint (extracted from the SVG diamonds).
export const NODE_XY: Record<NodeId, { x: number; y: number }> = {
  highsec: { x: 242, y: 474 },
  rentoffice: { x: 702, y: 475 },
  lowcost: { x: 1141, y: 474 },
  pawn: { x: 1614, y: 474 },
  discount: { x: 2049, y: 474 },
  frosty: { x: 2078, y: 925 },
  offrack: { x: 2058, y: 1373 },
  electronics: { x: 2058, y: 1825 },
  university: { x: 1613, y: 1825 },
  employment: { x: 787, y: 1825 },
  factory: { x: 293, y: 1825 },
  bank: { x: 239, y: 1375 },
  tryandsave: { x: 249, y: 925 },
};
