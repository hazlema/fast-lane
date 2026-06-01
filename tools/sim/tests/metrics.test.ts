// tools/sim/tests/metrics.test.ts
import { test, expect } from "bun:test";
import { median, percentile, netWorthSeries, phaseAverages, summary, type GameResult } from "../metrics";

const game = (netWorthByWeek: number[], over: Partial<GameResult> = {}): GameResult => ({
  seed: 1, won: false, winWeek: null, evicted: false, weeksPlayed: netWorthByWeek.length, netWorthByWeek, ...over,
});

test("median handles odd, even, empty", () => {
  expect(median([3, 1, 2])).toBe(2);
  expect(median([1, 2, 3, 4])).toBe(2.5);
  expect(median([])).toBe(0);
});

test("percentile interpolates", () => {
  expect(percentile([10, 20, 30, 40], 25)).toBeCloseTo(17.5);
  expect(percentile([5], 50)).toBe(5);
});

test("netWorthSeries aggregates per week and stops when no game reaches it", () => {
  const series = netWorthSeries([game([100, 200]), game([300])], 5);
  expect(series.length).toBe(2);                 // no game has a week 3
  expect(series[0]).toMatchObject({ week: 1, n: 2, median: 200 }); // median of [100,300]
  expect(series[1]).toMatchObject({ week: 2, n: 1, median: 200 }); // only the first game
});

test("phaseAverages splits early vs established by week", () => {
  const p = phaseAverages([game([0, 0, 100, 100])], 2);
  expect(p.early).toBe(0);         // weeks 1–2
  expect(p.established).toBe(100); // weeks 3–4
});

test("summary reports win rate, eviction, median win week", () => {
  const s = summary([
    game([], { won: true, winWeek: 10 }),
    game([], { evicted: true }),
  ]);
  expect(s.winRate).toBe(0.5);
  expect(s.evictedPct).toBe(0.5);
  expect(s.medianWinWeek).toBe(10);
});
