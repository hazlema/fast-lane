// tools/sim/run.ts
//
// Headless balance harness: play the heuristic bot across many seeded games and
// print how the player's net worth evolves — the "scraping by → comfortable"
// arc. Run: bun tools/sim/run.ts [--seeds N] [--cap W] [--split S]
import { newGame } from "../../game/engine/loop";
import { applyAction } from "../../game/engine/reducer";
import { WORLD } from "../../game/data/world";
import { CONFIG } from "../../game/data/config";
import { wealthOf } from "../../game/engine/winCheck";
import type { Stat } from "../../game/engine/state";
import { decide, sig } from "./bot";
import type { GameResult } from "./metrics";
import { printReport } from "./report";

function playGame(seed: number, goals: Record<Stat, number>, weekCap: number): GameResult {
  let g = newGame({ playerName: "Bot", startNode: "lowcost", seed, startHousing: "lowcost" });
  g = applyAction(g, { type: "setGoals", goals }, WORLD).state; // setup → playing (week 1)

  const netWorthByWeek: number[] = [];
  let won = false, winWeek: number | null = null, evicted = false;
  const blocked = new Set<string>();
  let safety = 0;

  while (g.phase === "playing" && g.week <= weekCap && safety++ < 100_000) {
    const me = g.players[g.current];
    const action = me.timeLeft <= 0 ? { type: "endWeek" as const } : decide(g, WORLD, blocked);

    if (action.type === "endWeek") {
      netWorthByWeek[g.week - 1] = wealthOf(g.players[g.current]); // end-of-week snapshot
      const endedWeek = g.week;
      g = applyAction(g, { type: "endWeek" }, WORLD).state;
      blocked.clear();
      if (g.phase === "won") { won = true; winWeek = endedWeek; break; }
      if (g.phase === "lost") { evicted = true; break; }
      continue;
    }

    const r = applyAction(g, action, WORLD);
    if (!r.ok) { blocked.add(sig(action)); continue; } // route around what we can't do this turn
    g = r.state;
  }

  return { seed, won, winWeek, evicted, weeksPlayed: netWorthByWeek.length, netWorthByWeek };
}

function arg(flag: string, dflt: number): number {
  const i = process.argv.indexOf(flag);
  return i >= 0 && process.argv[i + 1] ? Number(process.argv[i + 1]) : dflt;
}

export function runSimulation(seeds: number, weekCap: number, splitWeek: number) {
  const goals = { ...CONFIG.defaultGoals };
  const results: GameResult[] = [];
  for (let s = 1; s <= seeds; s++) results.push(playGame(s, goals, weekCap));
  printReport(results, { seeds, weekCap, splitWeek, goals });
  return results;
}

if (import.meta.main) {
  runSimulation(arg("--seeds", 500), arg("--cap", 80), arg("--split", 12));
}
