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
