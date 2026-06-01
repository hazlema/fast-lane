// tools/sim/metrics.ts
//
// Pure aggregation over simulated games. No engine imports — just arithmetic on
// the results the runner collects, so it's trivially testable.

export interface GameResult {
  seed: number;
  won: boolean;
  winWeek: number | null;       // week the goals were met, if won
  evicted: boolean;
  weeksPlayed: number;          // how many weeks this game ran
  netWorthByWeek: number[];     // net worth (cash + bank − debt) at the END of each week; [0] = week 1
}

export function median(xs: number[]): number {
  return percentile(xs, 50);
}

// Linear-interpolated percentile (p in 0..100). Empty → 0.
export function percentile(xs: number[], p: number): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  if (s.length === 1) return s[0];
  const rank = (p / 100) * (s.length - 1);
  const lo = Math.floor(rank), hi = Math.ceil(rank);
  if (lo === hi) return s[lo];
  return s[lo] + (s[hi] - s[lo]) * (rank - lo);
}

export interface WeekPoint { week: number; median: number; p25: number; p75: number; n: number }

// Median (and quartile band) net worth at each week, across every game still
// running that week. Games that already won/ended contribute no point past
// their last week.
export function netWorthSeries(results: GameResult[], maxWeek: number): WeekPoint[] {
  const out: WeekPoint[] = [];
  for (let w = 1; w <= maxWeek; w++) {
    const vals = results
      .filter((r) => r.netWorthByWeek.length >= w)
      .map((r) => r.netWorthByWeek[w - 1]);
    if (vals.length === 0) break;
    out.push({ week: w, median: median(vals), p25: percentile(vals, 25), p75: percentile(vals, 75), n: vals.length });
  }
  return out;
}

// Average net worth in the "early" phase (weeks 1..splitWeek) vs "established"
// (after splitWeek), pooled across all games and the weeks they actually played.
export function phaseAverages(results: GameResult[], splitWeek: number): { early: number; established: number } {
  const early: number[] = [], established: number[] = [];
  for (const r of results) {
    r.netWorthByWeek.forEach((nw, i) => ((i + 1 <= splitWeek ? early : established).push(nw)));
  }
  return {
    early: early.length ? early.reduce((a, b) => a + b, 0) / early.length : 0,
    established: established.length ? established.reduce((a, b) => a + b, 0) / established.length : 0,
  };
}

export function summary(results: GameResult[]): { games: number; winRate: number; medianWinWeek: number; evictedPct: number } {
  const wins = results.filter((r) => r.won);
  const winWeeks = wins.map((r) => r.winWeek!).filter((w) => w != null);
  return {
    games: results.length,
    winRate: results.length ? wins.length / results.length : 0,
    medianWinWeek: winWeeks.length ? median(winWeeks) : 0,
    evictedPct: results.length ? results.filter((r) => r.evicted).length / results.length : 0,
  };
}
