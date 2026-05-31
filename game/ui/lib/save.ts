// game/ui/lib/save.ts
import type { GameState } from "../../engine/state";

const VERSION = 6; // bumped for weekly budget 30

export interface SaveData {
  state: GameState;
  screen: string;
}

interface Envelope extends SaveData { version: number; }

export function serialize(data: SaveData): string {
  const env: Envelope = { version: VERSION, ...data };
  return JSON.stringify(env);
}

// Returns null for anything we can't safely load (missing, malformed, or an
// incompatible save version) — the caller then starts a fresh game.
export function deserialize(raw: string | null): SaveData | null {
  if (!raw) return null;
  try {
    const env = JSON.parse(raw) as Partial<Envelope>;
    if (env.version !== VERSION || !env.state) return null;
    return { state: env.state as GameState, screen: env.screen ?? "home" };
  } catch {
    return null;
  }
}
