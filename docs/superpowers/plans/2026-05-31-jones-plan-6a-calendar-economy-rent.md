# Jones Plan 6a — Calendar, Economy Index, Home, Rent & Wages — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lay the economic foundation for Plan 6 — a week/month calendar, a fluctuating seeded **economy index** that drives prices up and **wages inversely**, **return-home** each week, and **monthly rent** that accrues and is **paid in person at the Rent Office** (replacing the old weekly auto-deduction).

**Architecture:** All changes keep the pure-engine + thin-Svelte contract from Plans 1–5. New pure modules (`calendar.ts`, `economyIndex.ts`) are DOM-free and unit-tested; `wages.ts` gains an inverse-inflation factor; the rent model moves from a per-week `Player.weeklyRent` auto-charge to a monthly `Player.rentDue` balance accrued in `endWeek` and paid via a new `payRent` action. The UI store/Hud/Rent-Office screen surface the new state.

**Tech Stack:** TypeScript (strict), Bun test, Svelte 5 (runes), Vite. Engine is DOM-free; UI under `game/ui/`.

**Design spec:** `docs/superpowers/specs/2026-05-31-jones-plan-6-gameplay-depth-design.md` (Mechanics 1, 2, 10 + the `endWeek` pipeline).

---

## File Structure

**New (pure engine, `bun test`):**
- `game/engine/calendar.ts` (+ `calendar.test.ts`) — `monthOf` / `weekOfMonth` / `isMonthEnd`.
- `game/engine/economyIndex.ts` (+ `economyIndex.test.ts`) — `nextIndex` bounded random walk.
- `game/engine/actions/payRent.ts` (+ `payRent.test.ts`) — pay accrued rent at the Rent Office.

**Modified (engine):**
- `game/data/config.ts` — new tunables.
- `game/data/housing.ts` — `weeklyRent` → `monthlyRent`.
- `game/engine/state.ts` — `GameState.economyIndex`, `Player.rentDue`, drop `Player.weeklyRent`, optional `startHousing`.
- `game/engine/wages.ts` — inverse-inflation factor.
- `game/engine/economy.ts` — remove obsolete `settleRent`.
- `game/engine/actions/work.ts` — pass `economyIndex` to `wageFor`.
- `game/engine/actions/rent.ts` — set `housingId` only.
- `game/engine/actions/endWeek.ts` — new pipeline (index re-roll, monthly rent accrual, return home).
- `game/engine/reducer.ts` — register `payRent`.
- Tests updated in lock-step: `state.test.ts`, `economy.test.ts`, `rent.test.ts`, `endWeek.test.ts`.

**Modified (UI):**
- `game/ui/lib/save.ts` — bump save `VERSION` (state shape changed).
- `game/ui/stores/game.svelte.ts` — start renting Low Cost; `economyIndex`/`month` getters; `payRent()`.
- `game/ui/Hud.svelte` — month, rent-due, cost-of-living chips.
- `game/ui/screens/BuildingScreen.svelte` — Rent Office Pay-Rent control; monthly rent badge.

---

## Task 1: Calendar helpers

**Files:**
- Create: `game/engine/calendar.ts`, `game/engine/calendar.test.ts`
- Modify: `game/data/config.ts`

- [ ] **Step 1: Add `weeksPerMonth` to CONFIG**

In `game/data/config.ts`, add this line inside the `CONFIG` object (after `hopCost: 5,`):

```ts
  weeksPerMonth: 4,    // a "month" is 4 weeks (rent + inflation cadence)
```

- [ ] **Step 2: Write the failing test `game/engine/calendar.test.ts`**

```ts
// game/engine/calendar.test.ts
import { test, expect } from "bun:test";
import { monthOf, weekOfMonth, isMonthEnd } from "./calendar";

test("monthOf groups weeks into 4-week months", () => {
  expect(monthOf(1)).toBe(1);
  expect(monthOf(4)).toBe(1);
  expect(monthOf(5)).toBe(2);
  expect(monthOf(8)).toBe(2);
  expect(monthOf(9)).toBe(3);
});

test("weekOfMonth cycles 1..4", () => {
  expect(weekOfMonth(1)).toBe(1);
  expect(weekOfMonth(4)).toBe(4);
  expect(weekOfMonth(5)).toBe(1);
});

test("isMonthEnd is true only on the 4th week of a month", () => {
  expect(isMonthEnd(4)).toBe(true);
  expect(isMonthEnd(8)).toBe(true);
  expect(isMonthEnd(1)).toBe(false);
  expect(isMonthEnd(5)).toBe(false);
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `bun test game/engine/calendar.test.ts`
Expected: FAIL — `Cannot find module './calendar'`.

- [ ] **Step 4: Write `game/engine/calendar.ts`**

```ts
// game/engine/calendar.ts
// A "month" is CONFIG.weeksPerMonth weeks. Weeks are 1-based.
import { CONFIG } from "../data/config";

export function monthOf(week: number): number {
  return Math.floor((week - 1) / CONFIG.weeksPerMonth) + 1;
}

export function weekOfMonth(week: number): number {
  return ((week - 1) % CONFIG.weeksPerMonth) + 1;
}

// True on the last week of a month (when monthly rent comes due).
export function isMonthEnd(week: number): boolean {
  return week % CONFIG.weeksPerMonth === 0;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `bun test game/engine/calendar.test.ts`
Expected: PASS — 3 tests.

- [ ] **Step 6: Commit**

```bash
git add game/engine/calendar.ts game/engine/calendar.test.ts game/data/config.ts
git commit -m "feat(engine): week/month calendar helpers"
```

---

## Task 2: Economy index (bounded random walk)

**Files:**
- Create: `game/engine/economyIndex.ts`, `game/engine/economyIndex.test.ts`
- Modify: `game/data/config.ts`

- [ ] **Step 1: Add index tunables to CONFIG**

In `game/data/config.ts`, add inside `CONFIG` (after the `weeksPerMonth` line from Task 1):

```ts
  // Economy index (fluctuating inflation; Mechanic 10)
  indexStart: 1.0,     // starting economic index
  indexStepMax: 0.08,  // max +/- change per week
  indexFloor: 0.5,     // cheapest economy (deflation)
  indexCeil: 1.8,      // most expensive economy (high inflation)
```

- [ ] **Step 2: Write the failing test `game/engine/economyIndex.test.ts`**

```ts
// game/engine/economyIndex.test.ts
import { test, expect } from "bun:test";
import { nextIndex } from "./economyIndex";
import { makeRng } from "./rng";
import { CONFIG } from "../data/config";

test("nextIndex moves by at most indexStepMax", () => {
  const rand = makeRng(123);
  const v = nextIndex(1.0, rand);
  expect(Math.abs(v - 1.0)).toBeLessThanOrEqual(CONFIG.indexStepMax + 1e-9);
});

test("nextIndex is deterministic for a given seed", () => {
  expect(nextIndex(1.0, makeRng(42))).toBe(nextIndex(1.0, makeRng(42)));
});

test("nextIndex stays within [floor, ceil] over a long walk", () => {
  const rand = makeRng(7);
  let v = 1.0;
  for (let i = 0; i < 500; i++) {
    v = nextIndex(v, rand);
    expect(v).toBeGreaterThanOrEqual(CONFIG.indexFloor);
    expect(v).toBeLessThanOrEqual(CONFIG.indexCeil);
  }
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `bun test game/engine/economyIndex.test.ts`
Expected: FAIL — `Cannot find module './economyIndex'`.

- [ ] **Step 4: Write `game/engine/economyIndex.ts`**

```ts
// game/engine/economyIndex.ts
// The economy index drifts up and down via a seeded bounded random walk.
// Prices scale with it; wages scale inversely (see wages.ts).
import { CONFIG } from "../data/config";

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

// Given the current index and a seeded RNG, return next week's index.
export function nextIndex(current: number, rand: () => number): number {
  const step = (rand() * 2 - 1) * CONFIG.indexStepMax; // [-stepMax, +stepMax]
  return clamp(current + step, CONFIG.indexFloor, CONFIG.indexCeil);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `bun test game/engine/economyIndex.test.ts`
Expected: PASS — 3 tests.

- [ ] **Step 6: Commit**

```bash
git add game/engine/economyIndex.ts game/engine/economyIndex.test.ts game/data/config.ts
git commit -m "feat(engine): seeded economy index (bounded random walk)"
```

---

## Task 3: Wages scale inversely with the economy index

**Files:**
- Modify: `game/engine/wages.ts`, `game/engine/wages.test.ts`, `game/engine/actions/work.ts`

- [ ] **Step 1: Extend the wages test**

Replace the entire contents of `game/engine/wages.test.ts` with:

```ts
// game/engine/wages.test.ts
import { test, expect } from "bun:test";
import { wageFor } from "./wages";
import type { Job } from "../data/jobs";

const job: Job = { id: "x", title: "X", buildingId: "b", wage: 100, timeCost: 10, requiredEducation: 0 };

test("wage at career level 0 and a normal economy is the base wage", () => {
  expect(wageFor(job, 0, 1)).toBe(100);
});

test("each career level adds the configured bonus", () => {
  expect(wageFor(job, 2, 1)).toBe(150); // 100 × (1 + 2 × 0.25)
});

test("wage is rounded to a whole number", () => {
  const j2 = { ...job, wage: 90 };
  expect(wageFor(j2, 1, 1)).toBe(113); // 90 × 1.25 = 112.5 → 113
});

test("higher inflation lowers take-home (inverse), lower inflation raises it", () => {
  expect(wageFor(job, 0, 2)).toBe(50);   // index 2 → half pay
  expect(wageFor(job, 0, 0.5)).toBe(200); // index 0.5 → double pay
});

test("economyIndex defaults to 1 (no effect) when omitted", () => {
  expect(wageFor(job, 0)).toBe(100);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test game/engine/wages.test.ts`
Expected: FAIL — `wageFor` ignores the third arg (the index cases return 100, not 50/200).

- [ ] **Step 3: Update `game/engine/wages.ts`**

Replace its contents with:

```ts
// game/engine/wages.ts
import type { Job } from "../data/jobs";
import { CONFIG } from "../data/config";

// Pay for one shift: boosted by career level, scaled INVERSELY by the economy
// index (inflation up → take-home down). economyIndex defaults to 1 (no effect).
export function wageFor(job: Job, careerLevel: number, economyIndex = 1): number {
  const base = job.wage * (1 + careerLevel * CONFIG.careerWageBonus);
  return Math.round(base / economyIndex);
}
```

  (The `work` action will start passing `state.economyIndex` to `wageFor` in Task 4, where that field is added — keeping this task green on its own. `wageFor`'s `economyIndex` default of `1` means existing callers are unaffected until then.)

- [ ] **Step 4: Run tests**

Run: `bun test game/engine/wages.test.ts`
Expected: PASS — 5 tests.

Run: `bun test game/engine/actions/work.test.ts`
Expected: PASS — `work` still calls `wageFor(job, careerLevel)` (default index 1), so the janitor wage is unchanged.

- [ ] **Step 5: Commit**

```bash
git add game/engine/wages.ts game/engine/wages.test.ts
git commit -m "feat(engine): wages scale inversely with the economy index"
```

---

## Task 4: Rent model refactor — monthly `rentDue`, return-home, new endWeek pipeline

This is the core refactor. It must change several files together to keep the build green. Touch them in this order, then run the full suite at the end.

**Files:**
- Modify: `game/engine/state.ts`, `game/data/housing.ts`, `game/engine/actions/rent.ts`, `game/engine/economy.ts`, `game/engine/actions/endWeek.ts`
- Test: `game/engine/state.test.ts`, `game/engine/actions/rent.test.ts`, `game/engine/economy.test.ts`, `game/engine/actions/endWeek.test.ts`

- [ ] **Step 1: `state.ts` — add `economyIndex`/`rentDue`, drop `weeklyRent`, add `startHousing`**

In `game/engine/state.ts`:

(a) In `interface Player`, **remove** the line `weeklyRent: number;` and **add** in its place:
```ts
  rentDue: number;             // accrued unpaid rent (paid at the Rent Office)
```

(b) In `interface GameState`, add after `phase: Phase;`:
```ts
  economyIndex: number;        // fluctuating inflation index (Mechanic 10)
```

(c) Import `HousingId` — the file already imports from `../data/board`; add this import near the top (after the existing imports):
```ts
import type { HousingId } from "./state";
```
That is circular; instead reuse the existing `HousingId` type already declared in this file (it is defined here as `export type HousingId = string;`). **Do not add an import** — `HousingId` is already in scope. (This sub-note exists to prevent a wrong import; just use `HousingId` directly.)

(d) Change the `createGame` signature and body. Replace:
```ts
export function createGame(opts: {
  playerName: string;
  startNode: NodeId;
  seed: number;
}): GameState {
  const player: Player = {
    id: "p0",
    name: opts.playerName,
    position: opts.startNode,
    cash: CONFIG.startingCash,
    bank: CONFIG.startingBank,
    debt: 0,
    happiness: 0,
    education: 0,
    careerLevel: 0,
    jobId: null,
    experience: 0,
    inventory: [],
    weeklyRent: 0,
    housingId: null,
    timeLeft: 0,
    travelMultiplier: 1,
  };
  return {
    players: [player],
    current: 0,
    week: 1,
    phase: "setup",
    goals: { ...CONFIG.defaultGoals },
    seed: opts.seed,
    log: [],
  };
}
```
with:
```ts
export function createGame(opts: {
  playerName: string;
  startNode: NodeId;
  seed: number;
  startHousing?: HousingId; // if set, the player begins already renting this unit
}): GameState {
  const player: Player = {
    id: "p0",
    name: opts.playerName,
    position: opts.startNode,
    cash: CONFIG.startingCash,
    bank: CONFIG.startingBank,
    debt: 0,
    happiness: 0,
    education: 0,
    careerLevel: 0,
    jobId: null,
    experience: 0,
    inventory: [],
    rentDue: 0,
    housingId: opts.startHousing ?? null,
    timeLeft: 0,
    travelMultiplier: 1,
  };
  return {
    players: [player],
    current: 0,
    week: 1,
    phase: "setup",
    economyIndex: CONFIG.indexStart,
    goals: { ...CONFIG.defaultGoals },
    seed: opts.seed,
    log: [],
  };
}
```

- [ ] **Step 2: `housing.ts` — rename `weeklyRent` → `monthlyRent`**

Replace the contents of `game/data/housing.ts` with:

```ts
// game/data/housing.ts
import type { HousingId } from "../engine/state";

export interface Housing {
  id: HousingId;
  name: string;
  monthlyRent: number; // charged once a month (× economy index)
}

export const HOUSING: Record<HousingId, Housing> = {
  lowcost:  { id: "lowcost",  name: "Low Cost Housing", monthlyRent: 40 },
  highsec:  { id: "highsec",  name: "High Security Apartments", monthlyRent: 120 },
};
```

- [ ] **Step 3: `rent.ts` — set `housingId` only**

In `game/engine/actions/rent.ts`, change the final return:
```ts
  return ok(updateCurrent(state, (p) => ({ ...p, housingId: action.unit, weeklyRent: unit.weeklyRent })));
```
to:
```ts
  return ok(updateCurrent(state, (p) => ({ ...p, housingId: action.unit })));
```
(`unit` is still used by the preceding existence check; leave that line as-is.)

- [ ] **Step 4: `economy.ts` — remove the obsolete `settleRent`**

In `game/engine/economy.ts`, **delete** the entire `settleRent` function and its comment:
```ts
// Pay weekly rent from cash; any shortfall becomes debt (gentle failure).
export function settleRent(p: Player): Player {
  const owed = p.weeklyRent;
  const paid = Math.min(owed, p.cash);
  return { ...p, cash: p.cash - paid, debt: p.debt + (owed - paid) };
}
```
Leave `accrueInterest`, `checkPromotion`, `decayHappiness` untouched. (`Player` is still imported and used by the others.)

- [ ] **Step 5: `endWeek.ts` — new settlement pipeline**

Replace the contents of `game/engine/actions/endWeek.ts` with:

```ts
// game/engine/actions/endWeek.ts
import type { GameState, Player, LogEntry } from "../state";
import type { World } from "../world";
import { type ApplyResult, ok, reject } from "../result";
import { CONFIG } from "../../data/config";
import { accrueInterest, checkPromotion, decayHappiness } from "../economy";
import { makeRng } from "../rng";
import { nextIndex } from "../economyIndex";
import { isMonthEnd } from "../calendar";
import { hasWon } from "../winCheck";

export interface EndWeekAction {
  type: "endWeek";
}

export function endWeek(state: GameState, _action: EndWeekAction, world: World): ApplyResult {
  if (state.phase !== "playing") return reject(state, "Can only end the week while playing.");

  const i = state.current;
  const before = state.players[i];

  // 1. Re-roll the economy index for the coming week (seeded → deterministic).
  const economyIndex = nextIndex(state.economyIndex, makeRng(state.seed + state.week));

  // 2. Bank/loan interest.
  const afterInterest = accrueInterest(before);

  // 3. Monthly rent: at a month boundary, add this month's rent (× index) to the tab.
  let monthlyRent = 0;
  let afterRent = afterInterest;
  if (isMonthEnd(state.week) && afterInterest.housingId) {
    const unit = world.housing[afterInterest.housingId];
    if (unit) {
      monthlyRent = Math.round(unit.monthlyRent * economyIndex);
      afterRent = { ...afterInterest, rentDue: afterInterest.rentDue + monthlyRent };
    }
  }

  // 4. Promotion, 5. happiness decay.
  const afterPromo = checkPromotion(afterRent);
  const afterDecay = decayHappiness(afterPromo);

  // 6. Return home (free): live at the node of the building matching housingId.
  const homeNode = world.buildings.find((b) => b.id === afterDecay.housingId)?.node ?? afterDecay.position;

  // 7. Reset time for the new week.
  const settled: Player = { ...afterDecay, position: homeNode, timeLeft: CONFIG.weeklyTimeBudget };

  // News lines for whatever actually happened.
  const lines: string[] = [];
  const bankInterest = afterInterest.bank - before.bank;
  if (bankInterest > 0) lines.push(`Bank paid you $${bankInterest} interest.`);
  const loanInterest = afterInterest.debt - before.debt;
  if (loanInterest > 0) lines.push(`Your loan accrued $${loanInterest} interest.`);
  if (monthlyRent > 0) lines.push(`Rent of $${monthlyRent} came due — pay it at the Rent Office.`);
  if (afterPromo.careerLevel > afterRent.careerLevel) {
    lines.push(`Promoted to career level ${afterPromo.careerLevel}!`);
  }
  const happinessLost = afterPromo.happiness - afterDecay.happiness;
  if (happinessLost > 0) lines.push(`Happiness drifted down ${happinessLost}.`);
  if (lines.length === 0) lines.push("A quiet weekend.");

  const log: LogEntry[] = [
    ...state.log,
    ...lines.map((text) => ({ week: state.week, text })),
  ];
  const players = state.players.map((p, idx) => (idx === i ? settled : p));
  let next: GameState = { ...state, players, week: state.week + 1, economyIndex, log };

  if (hasWon(next, i)) {
    next = { ...next, phase: "won" };
  }
  return ok(next);
}
```

- [ ] **Step 5b: Wire the economy index into the `work` action**

Now that `GameState.economyIndex` exists, in `game/engine/actions/work.ts` change the wage line:
```ts
  const pay = wageFor(job, player.careerLevel);
```
to:
```ts
  const pay = wageFor(job, player.careerLevel, state.economyIndex);
```

- [ ] **Step 6: Update `state.test.ts`**

In `game/engine/state.test.ts`, in the second test ("seeds one player…"), **remove** the line `expect(p.weeklyRent).toBe(0);` and **add** these assertions (after `expect(p.housingId).toBeNull();`):

```ts
  expect(p.rentDue).toBe(0);
  expect(g.economyIndex).toBe(CONFIG.indexStart);
```

Add a new test at the end of the file:

```ts
test("createGame can start the player already renting a unit", () => {
  const g = createGame({ playerName: "Al", startNode: "n0", seed: 1, startHousing: "lowcost" });
  expect(g.players[0].housingId).toBe("lowcost");
});
```

- [ ] **Step 7: Update `economy.test.ts`**

In `game/engine/economy.test.ts`, change the import line to drop `settleRent`:
```ts
import { accrueInterest, settleRent, checkPromotion, decayHappiness } from "./economy";
```
to:
```ts
import { accrueInterest, checkPromotion, decayHappiness } from "./economy";
```
Then **delete** the two `settleRent` tests ("settleRent pays from cash" and "settleRent rolls the unpayable remainder into debt").

- [ ] **Step 8: Update `rent.test.ts`**

In `game/engine/actions/rent.test.ts`, in the first test ("renting sets weeklyRent and housingId"), rename it and drop the `weeklyRent` assertion. Replace that test with:

```ts
test("renting sets housingId", () => {
  const g = atRentOffice();
  const r = applyAction(g, { type: "rent", unit: "lowcost" }, TEST_WORLD);
  expect(r.ok).toBe(true);
  expect(r.state.players[0].housingId).toBe("lowcost");
});
```
(Leave the other two rent tests unchanged.)

- [ ] **Step 9: Update `endWeek.test.ts`**

Replace the contents of `game/engine/actions/endWeek.test.ts` with:

```ts
// game/engine/actions/endWeek.test.ts
import { test, expect } from "bun:test";
import { applyAction } from "../reducer";
import { createGame } from "../state";
import { TEST_WORLD } from "../../data/world";
import { CONFIG } from "../../data/config";

function playing(over: Partial<ReturnType<typeof createGame>["players"][number]> = {}, week = 1) {
  let g = createGame({ playerName: "Al", startNode: "n0", seed: 1 });
  g = applyAction(g, { type: "setGoals", goals: g.goals }, TEST_WORLD).state;
  g = { ...g, week, players: [{ ...g.players[0], ...over }] };
  return g;
}

test("endWeek advances the week and refills time", () => {
  const g = playing({ timeLeft: 3 });
  const r = applyAction(g, { type: "endWeek" }, TEST_WORLD);
  expect(r.ok).toBe(true);
  expect(r.state.week).toBe(2);
  expect(r.state.players[0].timeLeft).toBe(CONFIG.weeklyTimeBudget);
  expect(r.state.phase).toBe("playing");
});

test("endWeek accrues interest and decays happiness (no weekly rent anymore)", () => {
  const g = playing({ cash: 500, bank: 1000, debt: 0, happiness: 50 });
  const r = applyAction(g, { type: "endWeek" }, TEST_WORLD);
  const p = r.state.players[0];
  expect(p.bank).toBe(1020);     // +2% of 1000
  expect(p.cash).toBe(500);      // rent is NOT auto-deducted weekly anymore
  expect(p.happiness).toBe(45);  // -5 decay
});

test("endWeek re-rolls the economy index", () => {
  const g = playing();
  const r = applyAction(g, { type: "endWeek" }, TEST_WORLD);
  // Index changed from the start value via the seeded walk (seed 1, week 1).
  expect(typeof r.state.economyIndex).toBe("number");
  expect(r.state.economyIndex).toBeGreaterThanOrEqual(CONFIG.indexFloor);
  expect(r.state.economyIndex).toBeLessThanOrEqual(CONFIG.indexCeil);
});

test("monthly rent accrues to rentDue at a month boundary when housed", () => {
  const g = playing({ housingId: "lowcost", rentDue: 0 }, 4); // week 4 = month end
  const r = applyAction(g, { type: "endWeek" }, TEST_WORLD);
  expect(r.state.players[0].rentDue).toBeGreaterThan(0); // ~ round(40 × index)
  expect(r.state.log.some((e) => e.text.includes("Rent"))).toBe(true);
});

test("no rent accrues mid-month", () => {
  const g = playing({ housingId: "lowcost", rentDue: 0 }, 1); // week 1, not month end
  const r = applyAction(g, { type: "endWeek" }, TEST_WORLD);
  expect(r.state.players[0].rentDue).toBe(0);
});

test("endWeek sets phase to won when all goals are met", () => {
  const g = playing({ cash: 99999, happiness: 999, education: 999, careerLevel: 99 });
  const r = applyAction(g, { type: "endWeek" }, TEST_WORLD);
  expect(r.state.phase).toBe("won");
});

test("endWeek is rejected when not playing", () => {
  const g = createGame({ playerName: "Al", startNode: "n0", seed: 1 }); // setup phase
  const r = applyAction(g, { type: "endWeek" }, TEST_WORLD);
  expect(r.ok).toBe(false);
});
```

- [ ] **Step 10: Run the full suite + engine typecheck**

Run: `bun test`
Expected: PASS — all tests green (calendar + economyIndex + updated engine tests; `work`/`playthrough`/`realboard` unaffected).

Run: `bunx tsc --noEmit -p tsconfig.json`
Expected: clean (no `weeklyRent` references remain in engine code).

- [ ] **Step 11: Commit**

```bash
git add game/engine/state.ts game/data/housing.ts game/engine/actions/rent.ts game/engine/economy.ts game/engine/actions/endWeek.ts game/engine/actions/work.ts game/engine/state.test.ts game/engine/economy.test.ts game/engine/actions/rent.test.ts game/engine/actions/endWeek.test.ts
git commit -m "feat(engine): monthly rent (rentDue) + return-home + economy-index endWeek pipeline"
```

---

## Task 5: `payRent` action

**Files:**
- Create: `game/engine/actions/payRent.ts`, `game/engine/actions/payRent.test.ts`
- Modify: `game/engine/reducer.ts`

- [ ] **Step 1: Write the failing test `game/engine/actions/payRent.test.ts`**

```ts
// game/engine/actions/payRent.test.ts
import { test, expect } from "bun:test";
import { applyAction } from "../reducer";
import { createGame } from "../state";
import { TEST_WORLD } from "../../data/world";

function atRentOffice(over = {}) {
  let g = createGame({ playerName: "Al", startNode: "n5", seed: 1 }); // rentoffice = n5
  g = applyAction(g, { type: "setGoals", goals: g.goals }, TEST_WORLD).state;
  g = { ...g, players: [{ ...g.players[0], ...over }] };
  return g;
}

test("payRent pays the full due amount from cash", () => {
  const g = atRentOffice({ cash: 200, rentDue: 40 });
  const r = applyAction(g, { type: "payRent" }, TEST_WORLD);
  expect(r.ok).toBe(true);
  expect(r.state.players[0].cash).toBe(160);
  expect(r.state.players[0].rentDue).toBe(0);
});

test("payRent makes a partial payment when cash is short", () => {
  const g = atRentOffice({ cash: 30, rentDue: 100 });
  const r = applyAction(g, { type: "payRent" }, TEST_WORLD);
  expect(r.ok).toBe(true);
  expect(r.state.players[0].cash).toBe(0);
  expect(r.state.players[0].rentDue).toBe(70);
});

test("payRent is rejected with nothing due", () => {
  const g = atRentOffice({ cash: 100, rentDue: 0 });
  const r = applyAction(g, { type: "payRent" }, TEST_WORLD);
  expect(r.ok).toBe(false);
  expect(r.reason).toMatch(/due/i);
});

test("payRent is rejected away from a rent office", () => {
  const g = atRentOffice({ cash: 100, rentDue: 40 });
  const moved = { ...g, players: [{ ...g.players[0], position: "n4" }] }; // bank
  const r = applyAction(moved, { type: "payRent" }, TEST_WORLD);
  expect(r.ok).toBe(false);
  expect(r.reason).toMatch(/rent office/i);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test game/engine/actions/payRent.test.ts`
Expected: FAIL — `Cannot find module './payRent'` (and reducer doesn't know `payRent`).

- [ ] **Step 3: Write `game/engine/actions/payRent.ts`**

```ts
// game/engine/actions/payRent.ts
import type { GameState } from "../state";
import type { World } from "../world";
import { type ApplyResult, ok, reject, updateCurrent } from "../result";
import { buildingAt } from "../../data/buildings";

export interface PayRentAction {
  type: "payRent";
}

export function payRent(state: GameState, _action: PayRentAction, world: World): ApplyResult {
  if (state.phase !== "playing") return reject(state, "Can only pay rent while playing.");
  const p = state.players[state.current];
  const here = buildingAt(world.buildings, p.position);
  const housing = here?.services.find((s) => s.kind === "housing");
  if (!housing) return reject(state, "Pay rent at the Rent Office.");
  if (p.rentDue <= 0) return reject(state, "No rent is due.");
  const pay = Math.min(p.rentDue, p.cash);
  if (pay <= 0) return reject(state, "Not enough cash to pay rent.");
  return ok(updateCurrent(state, (pl) => ({ ...pl, cash: pl.cash - pay, rentDue: pl.rentDue - pay })));
}
```

- [ ] **Step 4: Register `payRent` in the reducer**

In `game/engine/reducer.ts`:

(a) Add the import (after the `rent` import line):
```ts
import { payRent, type PayRentAction } from "./actions/payRent";
```
(b) Add `PayRentAction` to the `Action` union (append before `EndWeekAction`):
```ts
export type Action = SetGoalsAction | MoveToAction | WorkAction | ApplyForJobAction | TakeClassAction | BuyAction | BankAction | RentAction | PayRentAction | EndWeekAction;
```
(c) Add a case in the `switch` (before `case "endWeek":`):
```ts
    case "payRent":
      return payRent(state, action, world);
```

- [ ] **Step 5: Run tests**

Run: `bun test game/engine/actions/payRent.test.ts`
Expected: PASS — 4 tests.

- [ ] **Step 6: Commit**

```bash
git add game/engine/actions/payRent.ts game/engine/actions/payRent.test.ts game/engine/reducer.ts
git commit -m "feat(engine): payRent action (pay accrued rent at the Rent Office)"
```

---

## Task 6: UI store — start renting, expose index/month, payRent; bump save version

**Files:**
- Modify: `game/ui/lib/save.ts`, `game/ui/stores/game.svelte.ts`

- [ ] **Step 1: Bump the save version**

In `game/ui/lib/save.ts`, change:
```ts
const VERSION = 1;
```
to:
```ts
const VERSION = 2; // bumped for Plan 6a state shape (economyIndex, rentDue, no weeklyRent)
```
(Old v1 saves now fail `deserialize` cleanly and the store starts a fresh game — existing behavior.)

- [ ] **Step 2: Start renting Low Cost + import calendar**

In `game/ui/stores/game.svelte.ts`:

(a) Add an import (after the `board` import line):
```ts
import { monthOf } from "../../engine/calendar";
```
(b) In `newSetupGame()`, add `startHousing` so the real game begins already renting:
```ts
function newSetupGame(): GameState {
  // Starts in phase "setup": the GoalsScreen calls startGame() to begin.
  return createGame({ playerName: "You", startNode: START_NODE, seed: Date.now() >>> 0, startHousing: "lowcost" });
}
```

- [ ] **Step 3: Expose `economyIndex` and `month`, add `payRent()`**

In the `gameStore` object in `game/ui/stores/game.svelte.ts`, add these getters next to the other getters (after `get screen()`):
```ts
  get economyIndex(): number { return game.economyIndex; },
  get month(): number { return monthOf(game.week); },
```
And add a `payRent` method next to `endWeek` (after the `endWeek()` method):
```ts
  payRent(): void {
    if (this.dispatch({ type: "payRent" })) persist();
  },
```

- [ ] **Step 4: Typecheck**

Run: `bun run ui:check`
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add game/ui/lib/save.ts game/ui/stores/game.svelte.ts
git commit -m "feat(ui): start renting low-cost; expose economy index + month; payRent; save v2"
```

---

## Task 7: Hud — month, rent-due, and cost-of-living chips

**Files:**
- Modify: `game/ui/Hud.svelte`

- [ ] **Step 1: Add the new HUD values**

In `game/ui/Hud.svelte`, the `<script>` already derives `player`. Add after the `player` derivation:
```ts
  const month = $derived(gameStore.month);
  const rentDue = $derived(player.rentDue);
  const cost = $derived(gameStore.economyIndex); // 1.0 = normal cost of living
```

- [ ] **Step 2: Add chips to the top row**

In the `.top` chip row, replace the `Week` chip line:
```svelte
    <span class="chip">Week <b>{gameStore.state.week}</b></span>
```
with:
```svelte
    <span class="chip">Wk <b>{gameStore.state.week}</b> · M<b>{month}</b></span>
    <span class="chip" title="Cost of living (1.0 = normal)">📊 <b>{cost.toFixed(2)}</b></span>
```
And add a rent-due chip right after the bank chip (after the `🏦` chip line, before the debt `{#if}`):
```svelte
    {#if rentDue > 0}<span class="chip rent">🏠 <b>${rentDue}</b></span>{/if}
```

- [ ] **Step 3: Style the rent chip**

In the `<style>` block, after the `.chip.debt b { color: #c22; }` line, add:
```css
  .chip.rent b { color: #b8860b; }
```

- [ ] **Step 4: Typecheck**

Run: `bun run ui:check`
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add game/ui/Hud.svelte
git commit -m "feat(ui): HUD shows month, rent due, and cost-of-living"
```

---

## Task 8: Rent Office — Pay Rent control + monthly rent badge

**Files:**
- Modify: `game/ui/screens/BuildingScreen.svelte`

- [ ] **Step 1: Update the housing badge to monthly and add a Pay-Rent block**

In `game/ui/screens/BuildingScreen.svelte`, find the `housing` branch:
```svelte
    {:else if svc.kind === "housing"}
      {#each svc.housingIds as id (id)}
        {@const h = HOUSING[id]}
        {@const a = { type: "rent", unit: id } as const}
        {@const d = dis(a)}
        <ActionRow name={h.name}
          sub={player.housingId === id ? "current home" : ""}
          badges={[{ text: `🏠 $${h.weeklyRent}/wk`, kind: "cost" }]}
          disabled={d.disabled} reason={d.reason} onact={() => gameStore.dispatch(a)} />
      {/each}
```
Replace it with (changes the badge to `/mo`, marks current home, and adds the Pay-Rent control above the unit list):
```svelte
    {:else if svc.kind === "housing"}
      {@const pr = gameStore.preview({ type: "payRent" })}
      <div class="rentbar">
        <span>Rent due: <b>${player.rentDue}</b></span>
        <button class="pay" disabled={!pr.ok} title={pr.ok ? "" : (pr.reason ?? "")}
          onclick={() => gameStore.payRent()}>Pay Rent</button>
      </div>
      {#each svc.housingIds as id (id)}
        {@const h = HOUSING[id]}
        {@const a = { type: "rent", unit: id } as const}
        {@const d = dis(a)}
        <ActionRow name={h.name}
          sub={player.housingId === id ? "current home" : "move in"}
          badges={[{ text: `🏠 $${h.monthlyRent}/mo`, kind: "cost" }]}
          disabled={d.disabled} reason={d.reason} onact={() => gameStore.dispatch(a)} />
      {/each}
```

- [ ] **Step 2: Add styles for the rent bar**

In the `<style>` block of `BuildingScreen.svelte`, add:
```css
  .rentbar { display: flex; align-items: center; justify-content: space-between; background: #fff; border-radius: 6px; padding: 6px 8px; margin-bottom: 6px; font-size: clamp(10px, 1.1vw, 12px); color: #2a2f1a; }
  .rentbar b { color: #b8860b; }
  .pay { background: #4a90d9; color: #fff; border: none; border-radius: 6px; padding: 5px 10px; font-size: clamp(10px, 1.1vw, 12px); font-weight: 700; cursor: pointer; }
  .pay:disabled { opacity: 0.5; cursor: not-allowed; }
```

- [ ] **Step 3: Typecheck**

Run: `bun run ui:check`
Expected: 0 errors. (Note: `gameStore.payRent` and `economyIndex`/`month` exist from Task 6; `h.monthlyRent` exists from Task 4.)

- [ ] **Step 4: Commit**

```bash
git add game/ui/screens/BuildingScreen.svelte
git commit -m "feat(ui): Rent Office Pay-Rent control + monthly rent badge"
```

---

## Task 9: Full verification

- [ ] **Step 1: Engine suite + typecheck**

Run: `bun test`
Expected: PASS — all tests (new calendar/economyIndex/payRent + updated engine tests), 0 fail.

Run: `bunx tsc --noEmit -p tsconfig.json`
Expected: clean.

- [ ] **Step 2: UI typecheck + build**

Run: `bun run ui:check && bun run ui:build`
Expected: 0 errors; build succeeds.

- [ ] **Step 3: Run the app and verify the new mechanics**

Run: `bun run ui:dev`, open http://localhost:5173, start a game (Easy preset), and verify:
- HUD shows `Wk 1 · M1`, a cost-of-living chip (≈1.00), and no rent-due chip yet.
- Play and **End Week** a few times: the cost-of-living number drifts up/down each week; at the **end of week 4** a **rent-due** chip appears (≈$40 × index) and the news says "Rent of $… came due."
- After any End Week, the player **token is back home** (at Low Cost Housing) at the start of the new week.
- Visit the **Rent Office** → the **Pay Rent** button clears the due balance (cash drops); with $0 due it's disabled.
- Get a job and **Work** under a high vs low cost-of-living: the wage badge/earnings are **lower when the cost-of-living chip is high**, higher when it's low (inverse).
- Reload the page → a pre-Plan-6a save (if any) is discarded and you get a fresh goal-setup (save v2); a fresh game resumes normally.

- [ ] **Step 4: Final commit (only if verification required fixes)**

```bash
git add -A
git commit -m "chore: Plan 6a verification fixes"
```
(Skip if nothing changed.)

---

## Self-Review (completed during planning)

**Spec coverage (Mechanics 1, 2, 10 + pipeline):**
- M1 return-home → Task 4 (endWeek `homeNode`). M2 monthly rent + Pay Rent → Tasks 4 (accrual) + 5 (payRent) + 8 (UI). M10 economy index + inverse wages → Tasks 2 (index) + 3 (wages) + 4 (re-roll in endWeek). Calendar (month) → Task 1. Start renting Low Cost → Tasks 4 (param) + 6 (store). HUD surfacing → Task 7. Save shape → Task 6. (Crisis/pay-cut and prices×index are deferred to Plans 6c/6d per the spec phasing — not in 6a.)

**Placeholder scan:** none — every code step shows full code; the one prose sub-note in Task 4 Step 1(c) deliberately tells the engineer NOT to add a circular import (prevents a known mistake), and is not a placeholder.

**Type consistency:** `wageFor(job, careerLevel, economyIndex=1)` defined in Task 3 (default keeps existing callers green); `work` is wired to pass `state.economyIndex` in Task 4 Step 5b, after the field exists. `Player.rentDue`/`GameState.economyIndex`/`createGame.startHousing`/`Housing.monthlyRent` defined in Task 4 and consumed by Tasks 5–8. `payRent` action/method defined in Tasks 5/6 and used in Task 8. `monthOf` defined Task 1, used Task 6. `nextIndex` defined Task 2, used Task 4. `isMonthEnd` defined Task 1, used Task 4. No `weeklyRent` references remain after Task 4 (verified by tsc).

**Green-at-each-commit:** every task's final commit compiles and passes its tests independently. Task 3 commits only `wages.ts`/`wages.test.ts` (the `economyIndex` default of 1 keeps `work` unchanged); the `work.ts` wiring lands in Task 4 alongside the field it depends on.
