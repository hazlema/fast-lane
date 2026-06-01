// tools/sim/report.ts
//
// Pretty-print the balance picture: the net-worth-over-time arc (median, with a
// p25–p75 band), an early-vs-established phase summary, and headline outcomes.
import type { Stat } from "../../game/engine/state";
import { type GameResult, netWorthSeries, phaseAverages, summary } from "./metrics";

const money = (n: number) => `$${Math.round(n).toLocaleString()}`;

export function printReport(
  results: GameResult[],
  opts: { seeds: number; weekCap: number; splitWeek: number; goals: Record<Stat, number> },
): void {
  const s = summary(results);
  const series = netWorthSeries(results, opts.weekCap);
  const phase = phaseAverages(results, opts.splitWeek);

  console.log("\n================ BALANCE REPORT ================");
  console.log(`Bot games: ${s.games} seeds · week cap ${opts.weekCap}`);
  console.log(`Goals: wealth ${opts.goals.wealth} · happy ${opts.goals.happiness} · edu ${opts.goals.education} · career ${opts.goals.career}`);
  console.log(`Win rate: ${(s.winRate * 100).toFixed(1)}%   median weeks-to-win: ${s.winRate > 0 ? s.medianWinWeek : "—"}   evicted: ${(s.evictedPct * 100).toFixed(1)}%`);

  console.log(`\n— Net worth over time (median, ▏=p25–p75 band) —`);
  const max = Math.max(1, ...series.map((p) => p.p75));
  const width = 40;
  for (const p of series) {
    const bar = "█".repeat(Math.round((p.median / max) * width));
    const band = `${money(p.p25)}–${money(p.p75)}`;
    console.log(`wk ${String(p.week).padStart(2)} │${bar.padEnd(width)}│ ${money(p.median).padStart(9)}  (${band}, n=${p.n})`);
  }

  console.log(`\n— Comfort phases (avg net worth) —`);
  console.log(`  early (wk 1–${opts.splitWeek}):   ${money(phase.early)}   ${verdict(phase.early, "early")}`);
  console.log(`  established (wk ${opts.splitWeek + 1}+): ${money(phase.established)}   ${verdict(phase.established, "late")}`);
  const growth = phase.early !== 0 ? (phase.established / phase.early) : 0;
  console.log(`  growth: ${growth.toFixed(1)}× from early → established`);
  console.log("\nNote: figures reflect THIS heuristic bot's play, not optimal play.");
  console.log("================================================\n");
}

// A light qualitative read to make the numbers legible at a glance. Thresholds
// are deliberately rough — they're a conversation starter, not a verdict.
function verdict(netWorth: number, phase: "early" | "late"): string {
  if (phase === "early") return netWorth < 300 ? "scraping by ✓" : netWorth < 1000 ? "getting by" : "already flush (too easy early?)";
  return netWorth < 500 ? "still scraping (too grindy?)" : netWorth < 2000 ? "getting comfortable" : "comfortable ✓";
}
