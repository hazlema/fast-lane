# Jones Plan 6b — University Enroll/Study + Two-Level Employment Office — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the instant `takeClass` with a **University enrollment → study-to-graduate** flow (one course at a time, education accrued over `studySessionsToGraduate` study sessions), and turn the **Employment Office** into a **two-level UI** (pick an employer, then apply for its openings).

**Architecture:** Engine stays pure. The instant `takeClass` action is replaced by two actions — `enroll {course}` (pay tuition once, lock in a course) and `study {}` (spend the course's time per visit, accrue partial education, graduate after N sessions). Hiring rules in the reducer are **unchanged**; the two-level Employment Office is a UI-only restructure (a new `HiringScreen` that groups the hiring service's `jobIds` by employer building). University UI becomes a new `EducationScreen` (enroll list vs. study view).

**Tech Stack:** TypeScript (strict), Bun test, Svelte 5 (runes), Vite.

**Design spec:** `docs/superpowers/specs/2026-05-31-jones-plan-6-gameplay-depth-design.md` (Mechanics 3 and 7).

---

## File Structure

**Engine (pure, `bun test`):**
- New: `game/engine/actions/enroll.ts` (+ `enroll.test.ts`), `game/engine/actions/study.ts` (+ `study.test.ts`).
- Modify: `game/data/config.ts` (`studySessionsToGraduate`), `game/engine/state.ts` (`Player.enrolledCourse`/`courseProgress` + `createGame` init), `game/engine/reducer.ts` (register enroll/study, drop takeClass).
- Delete: `game/engine/actions/takeClass.ts`, `game/engine/actions/takeClass.test.ts`.
- Rewrite the `takeClass` usage in `game/engine/playthrough.test.ts` and `game/engine/realboard.test.ts`.

**UI (verified by running):**
- New: `game/ui/screens/EducationScreen.svelte`, `game/ui/screens/HiringScreen.svelte`.
- Modify: `game/ui/screens/BuildingScreen.svelte` (education → `EducationScreen`, hiring → `HiringScreen`; drop now-unused `COURSES`/`CONFIG` imports), `game/ui/lib/save.ts` (bump `VERSION` to 3).

---

## Task 1: State + config for enrollment

**Files:**
- Modify: `game/data/config.ts`, `game/engine/state.ts`, `game/engine/state.test.ts`

- [ ] **Step 1: Add `studySessionsToGraduate` to CONFIG**

In `game/data/config.ts`, add inside `CONFIG` (after the `educationPerCareerLevel: 20,` line):
```ts
  studySessionsToGraduate: 3,  // study visits to finish a course (Plan 6b)
```

- [ ] **Step 2: Add enrollment fields to `Player` + `createGame`**

In `game/engine/state.ts`:

(a) Add a type-only import near the top (after the existing `import { CONFIG } ...` line):
```ts
import type { CourseId } from "../data/courses";
```
(b) In `interface Player`, add after `experience: number; ...` (just before `inventory: ItemId[];`):
```ts
  enrolledCourse: CourseId | null; // current University course, null if none
  courseProgress: number;          // study sessions completed toward graduation
```
(c) In `createGame`'s `player` object, add after `experience: 0,`:
```ts
    enrolledCourse: null,
    courseProgress: 0,
```

- [ ] **Step 3: Update `state.test.ts`**

In `game/engine/state.test.ts`, in the test "createGame seeds one player with starting money and no time yet", add after `expect(p.rentDue).toBe(0);`:
```ts
  expect(p.enrolledCourse).toBeNull();
  expect(p.courseProgress).toBe(0);
```

- [ ] **Step 4: Run tests + typecheck**

Run: `bun test game/engine/state.test.ts`
Expected: PASS.

Run: `bunx tsc --noEmit -p tsconfig.json`
Expected: clean (no consumers reference the new fields yet; `takeClass` still compiles).

- [ ] **Step 5: Commit**

```bash
git add game/data/config.ts game/engine/state.ts game/engine/state.test.ts
git commit -m "feat(engine): player enrollment state (enrolledCourse, courseProgress)"
```

---

## Task 2: `enroll` action

**Files:**
- Create: `game/engine/actions/enroll.ts`, `game/engine/actions/enroll.test.ts`
- Modify: `game/engine/reducer.ts`

- [ ] **Step 1: Write the failing test `game/engine/actions/enroll.test.ts`**

```ts
// game/engine/actions/enroll.test.ts
import { test, expect } from "bun:test";
import { applyAction } from "../reducer";
import { createGame } from "../state";
import { TEST_WORLD } from "../../data/world";

function atUniversity(over = {}) {
  let g = createGame({ playerName: "Al", startNode: "n3", seed: 1 }); // university = n3
  g = applyAction(g, { type: "setGoals", goals: g.goals }, TEST_WORLD).state;
  g = { ...g, players: [{ ...g.players[0], cash: 1000, ...over }] };
  return g;
}

test("enroll pays tuition and locks in the course", () => {
  const g = atUniversity();
  const c = TEST_WORLD.courses.basics;
  const r = applyAction(g, { type: "enroll", course: "basics" }, TEST_WORLD);
  expect(r.ok).toBe(true);
  const p = r.state.players[0];
  expect(p.enrolledCourse).toBe("basics");
  expect(p.courseProgress).toBe(0);
  expect(p.cash).toBe(1000 - c.cost);
});

test("enroll is rejected while already enrolled", () => {
  let g = atUniversity();
  g = applyAction(g, { type: "enroll", course: "basics" }, TEST_WORLD).state;
  const r = applyAction(g, { type: "enroll", course: "business" }, TEST_WORLD);
  expect(r.ok).toBe(false);
  expect(r.reason).toMatch(/already enrolled/i);
});

test("enroll is rejected without enough cash for tuition", () => {
  const g = atUniversity({ cash: 10 }); // basics costs 50
  const r = applyAction(g, { type: "enroll", course: "basics" }, TEST_WORLD);
  expect(r.ok).toBe(false);
  expect(r.reason).toMatch(/afford|tuition|cash/i);
});

test("enroll is rejected away from a university", () => {
  const g = atUniversity();
  const moved = { ...g, players: [{ ...g.players[0], position: "n4" }] }; // bank
  const r = applyAction(moved, { type: "enroll", course: "basics" }, TEST_WORLD);
  expect(r.ok).toBe(false);
  expect(r.reason).toMatch(/class|university|here/i);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test game/engine/actions/enroll.test.ts`
Expected: FAIL — `Cannot find module './enroll'` (and reducer doesn't know "enroll").

- [ ] **Step 3: Write `game/engine/actions/enroll.ts`**

```ts
// game/engine/actions/enroll.ts
import type { GameState } from "../state";
import type { CourseId } from "../../data/courses";
import type { World } from "../world";
import { type ApplyResult, ok, reject, updateCurrent } from "../result";
import { buildingAt } from "../../data/buildings";

export interface EnrollAction {
  type: "enroll";
  course: CourseId;
}

export function enroll(state: GameState, action: EnrollAction, world: World): ApplyResult {
  if (state.phase !== "playing") return reject(state, "Can only enroll while playing.");
  const p = state.players[state.current];
  if (p.enrolledCourse) return reject(state, "You're already enrolled in a course.");
  const here = buildingAt(world.buildings, p.position);
  const edu = here?.services.find((s) => s.kind === "education");
  if (!edu || edu.kind !== "education") return reject(state, "No classes offered here.");
  if (!edu.courseIds.includes(action.course)) return reject(state, "That course is not offered here.");
  const course = world.courses[action.course];
  if (!course) return reject(state, `Unknown course: ${action.course}`);
  if (course.cost > p.cash) return reject(state, "You can't afford the tuition.");
  return ok(updateCurrent(state, (pl) => ({ ...pl, cash: pl.cash - course.cost, enrolledCourse: action.course, courseProgress: 0 })));
}
```

- [ ] **Step 4: Register `enroll` in the reducer**

In `game/engine/reducer.ts`:
(a) Add import after the `takeClass` import line:
```ts
import { enroll, type EnrollAction } from "./actions/enroll";
```
(b) Add `EnrollAction` to the `Action` union (append after `TakeClassAction`):
```ts
export type Action = SetGoalsAction | MoveToAction | WorkAction | ApplyForJobAction | TakeClassAction | EnrollAction | BuyAction | BankAction | RentAction | PayRentAction | EndWeekAction;
```
(c) Add a case in the `switch` (after `case "takeClass": ...`):
```ts
    case "enroll":
      return enroll(state, action, world);
```

- [ ] **Step 5: Run tests**

Run: `bun test game/engine/actions/enroll.test.ts`
Expected: PASS — 4 tests.

- [ ] **Step 6: Commit**

```bash
git add game/engine/actions/enroll.ts game/engine/actions/enroll.test.ts game/engine/reducer.ts
git commit -m "feat(engine): enroll action (lock in a course, pay tuition)"
```

---

## Task 3: `study` action

Education accrues so the per-session gains telescope to exactly `course.educationGain` at graduation: each session grants `round(gain·new/sessions) − round(gain·old/sessions)`. After `studySessionsToGraduate` sessions the course graduates (enrollment clears).

**Files:**
- Create: `game/engine/actions/study.ts`, `game/engine/actions/study.test.ts`
- Modify: `game/engine/reducer.ts`

- [ ] **Step 1: Write the failing test `game/engine/actions/study.test.ts`**

```ts
// game/engine/actions/study.test.ts
import { test, expect } from "bun:test";
import { applyAction } from "../reducer";
import { createGame } from "../state";
import { TEST_WORLD } from "../../data/world";
import { CONFIG } from "../../data/config";

function enrolledAtUniversity(over = {}) {
  let g = createGame({ playerName: "Al", startNode: "n3", seed: 1 }); // university = n3
  g = applyAction(g, { type: "setGoals", goals: g.goals }, TEST_WORLD).state;
  g = { ...g, players: [{ ...g.players[0], cash: 1000, ...over }] };
  g = applyAction(g, { type: "enroll", course: "basics" }, TEST_WORLD).state;
  return g;
}

test("study costs time and graduates after the configured sessions, granting exactly the course's education", () => {
  let g = enrolledAtUniversity();
  const c = TEST_WORLD.courses.basics;
  let t = g.players[0].timeLeft;
  for (let i = 0; i < CONFIG.studySessionsToGraduate; i++) {
    const r = applyAction(g, { type: "study" }, TEST_WORLD);
    expect(r.ok).toBe(true);
    g = r.state;
    t -= c.timeCost;
    expect(g.players[0].timeLeft).toBe(t);
  }
  const p = g.players[0];
  expect(p.education).toBe(c.educationGain); // exactly, after graduation
  expect(p.enrolledCourse).toBeNull();        // graduated → free to enroll again
  expect(p.courseProgress).toBe(0);
});

test("study accrues partial education before graduating", () => {
  let g = enrolledAtUniversity();
  g = applyAction(g, { type: "study" }, TEST_WORLD).state;
  const p = g.players[0];
  expect(p.enrolledCourse).toBe("basics");           // still enrolled
  expect(p.education).toBeGreaterThan(0);             // partial credit
  expect(p.education).toBeLessThan(TEST_WORLD.courses.basics.educationGain);
  expect(p.courseProgress).toBe(1);
});

test("study is rejected when not enrolled", () => {
  let g = createGame({ playerName: "Al", startNode: "n3", seed: 1 });
  g = applyAction(g, { type: "setGoals", goals: g.goals }, TEST_WORLD).state;
  const r = applyAction(g, { type: "study" }, TEST_WORLD);
  expect(r.ok).toBe(false);
  expect(r.reason).toMatch(/enroll/i);
});

test("study is rejected without enough time", () => {
  const g = enrolledAtUniversity({ });
  const low = { ...g, players: [{ ...g.players[0], timeLeft: 1 }] };
  const r = applyAction(low, { type: "study" }, TEST_WORLD);
  expect(r.ok).toBe(false);
  expect(r.reason).toMatch(/time/i);
});

test("study is rejected away from a university", () => {
  const g = enrolledAtUniversity();
  const moved = { ...g, players: [{ ...g.players[0], position: "n4" }] }; // bank
  const r = applyAction(moved, { type: "study" }, TEST_WORLD);
  expect(r.ok).toBe(false);
  expect(r.reason).toMatch(/university|study|here/i);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test game/engine/actions/study.test.ts`
Expected: FAIL — `Cannot find module './study'`.

- [ ] **Step 3: Write `game/engine/actions/study.ts`**

```ts
// game/engine/actions/study.ts
import type { GameState } from "../state";
import type { World } from "../world";
import { type ApplyResult, ok, reject, updateCurrent } from "../result";
import { buildingAt, hasService } from "../../data/buildings";
import { CONFIG } from "../../data/config";

export interface StudyAction {
  type: "study";
}

export function study(state: GameState, _action: StudyAction, world: World): ApplyResult {
  if (state.phase !== "playing") return reject(state, "Can only study while playing.");
  const p = state.players[state.current];
  if (!p.enrolledCourse) return reject(state, "You're not enrolled in a course. Enroll first.");
  const here = buildingAt(world.buildings, p.position);
  if (!here || !hasService(here, "education")) return reject(state, "Study at the University.");
  const course = world.courses[p.enrolledCourse];
  if (!course) return reject(state, `Unknown course: ${p.enrolledCourse}`);
  if (course.timeCost > p.timeLeft) return reject(state, "Not enough time to study.");

  const sessions = CONFIG.studySessionsToGraduate;
  const newProgress = p.courseProgress + 1;
  // Telescoping per-session gain so the total equals course.educationGain at graduation.
  const gained =
    Math.round((course.educationGain * newProgress) / sessions) -
    Math.round((course.educationGain * p.courseProgress) / sessions);
  const graduating = newProgress >= sessions;

  return ok(
    updateCurrent(state, (pl) => ({
      ...pl,
      education: pl.education + gained,
      timeLeft: pl.timeLeft - course.timeCost,
      enrolledCourse: graduating ? null : pl.enrolledCourse,
      courseProgress: graduating ? 0 : newProgress,
    })),
  );
}
```

- [ ] **Step 4: Register `study` in the reducer**

In `game/engine/reducer.ts`:
(a) Add import after the `enroll` import line:
```ts
import { study, type StudyAction } from "./actions/study";
```
(b) Add `StudyAction` to the `Action` union (after `EnrollAction`):
```ts
export type Action = SetGoalsAction | MoveToAction | WorkAction | ApplyForJobAction | TakeClassAction | EnrollAction | StudyAction | BuyAction | BankAction | RentAction | PayRentAction | EndWeekAction;
```
(c) Add a case in the `switch` (after `case "enroll": ...`):
```ts
    case "study":
      return study(state, action, world);
```

- [ ] **Step 5: Run tests**

Run: `bun test game/engine/actions/study.test.ts`
Expected: PASS — 5 tests.

- [ ] **Step 6: Commit**

```bash
git add game/engine/actions/study.ts game/engine/actions/study.test.ts game/engine/reducer.ts
git commit -m "feat(engine): study action (accrue education, graduate after N sessions)"
```

---

## Task 4: Remove `takeClass`; migrate the integration tests

**Files:**
- Delete: `game/engine/actions/takeClass.ts`, `game/engine/actions/takeClass.test.ts`
- Modify: `game/engine/reducer.ts`, `game/engine/playthrough.test.ts`, `game/engine/realboard.test.ts`

- [ ] **Step 1: Delete the takeClass files**

```bash
git rm game/engine/actions/takeClass.ts game/engine/actions/takeClass.test.ts
```

- [ ] **Step 2: Remove `takeClass` from the reducer**

In `game/engine/reducer.ts`:
(a) Delete the import line `import { takeClass, type TakeClassAction } from "./actions/takeClass";`.
(b) Remove `TakeClassAction` from the `Action` union. The union becomes:
```ts
export type Action = SetGoalsAction | MoveToAction | WorkAction | ApplyForJobAction | EnrollAction | StudyAction | BuyAction | BankAction | RentAction | PayRentAction | EndWeekAction;
```
(c) Delete the `case "takeClass": return takeClass(state, action, world);` lines.

- [ ] **Step 3: Rewrite `playthrough.test.ts`**

Replace the action-sequence test (everything from `test("a productive week reaches a win against easy goals", ...` to the end of that test) with this version (enroll + study×3 graduates basics for the education goal; the player wins on the week-end because the easy goals need only wealth 100 / education 20):

```ts
// Route fits the 60-unit weekly budget: study 15×3 + move(n3→n2) 5 + apply 5 = 55.
test("a productive week reaches a win against easy goals", () => {
  let g = createGame({ playerName: "Al", startNode: "n3", seed: 7 }); // start at university (n3)
  // Easy goals: happiness target 0 (it decays at week-end); no career required.
  g = applyAction(g, {
    type: "setGoals",
    goals: { wealth: 100, happiness: 0, education: 20, career: 0 },
  }, TEST_WORLD).state;

  g = run(g, [
    { type: "enroll", course: "basics" },   // n3: pay 50 tuition, lock in basics
    { type: "study" },                       // +partial edu, -15 time
    { type: "study" },                       // +partial edu, -15 time
    { type: "study" },                       // graduates basics → education 20, -15 time
    { type: "moveTo", node: "n2" },          // to employment office (1 hop)
    { type: "applyForJob", job: "clerk" },   // needs education 20 ✓
  ]);

  const mid = g.players[0];
  expect(mid.jobId).toBe("clerk");
  expect(mid.education).toBe(20);            // graduated basics
  expect(mid.enrolledCourse).toBeNull();
  expect(mid.cash).toBe(150);                // 200 start − 50 tuition (no work this week)

  // Settle the week → wealth 150, education 20, happiness 0, career 0 → win.
  const r = applyAction(g, { type: "endWeek" }, TEST_WORLD);
  expect(r.ok).toBe(true);
  expect(r.state.phase).toBe("won");
});
```

- [ ] **Step 4: Rewrite `realboard.test.ts` (second test only)**

In `game/engine/realboard.test.ts`, replace the body of the test `"a player can travel the real ring, study, work, and win easy goals"` with:

```ts
test("a player can travel the real ring, study, work, and win easy goals", () => {
  let g = createGame({ playerName: "Al", startNode: "university", seed: 3 });
  g = applyAction(g, {
    type: "setGoals",
    goals: { wealth: 100, happiness: 0, education: 20, career: 0 },
  }, WORLD).state;

  g = run(g, [
    { type: "enroll", course: "basics" },          // at university: pay tuition, lock in
    { type: "study" }, { type: "study" }, { type: "study" }, // graduate → education 20
    { type: "moveTo", node: "employment" },         // travel the ring (1 hop)
    { type: "applyForJob", job: "clerk" },          // needs education 20 ✓
    { type: "endWeek" },
  ]);

  expect(g.players[0].jobId).toBe("clerk");
  expect(g.players[0].education).toBe(20);
  expect(g.phase).toBe("won");
});
```
(Leave the first test in the file — "buildings resolve on their own nodes on the real board" — unchanged.)

- [ ] **Step 5: Run the full suite + typecheck**

Run: `bun test`
Expected: PASS — all tests green (takeClass tests gone; enroll/study + rewritten playthrough/realboard pass). 0 fail.

Run: `bunx tsc --noEmit -p tsconfig.json`
Expected: clean (no `takeClass` references remain in engine code).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor(engine): replace takeClass with enroll/study; migrate playthrough+realboard"
```

---

## Task 5: Bump save version

**Files:**
- Modify: `game/ui/lib/save.ts`

- [ ] **Step 1: Bump VERSION**

In `game/ui/lib/save.ts`, change:
```ts
const VERSION = 2; // bumped for Plan 6a state shape (economyIndex, rentDue, no weeklyRent)
```
to:
```ts
const VERSION = 3; // bumped for Plan 6b state shape (enrolledCourse, courseProgress)
```

- [ ] **Step 2: Typecheck + commit**

Run: `bun run ui:check`
Expected: 0 errors.

```bash
git add game/ui/lib/save.ts
git commit -m "chore(ui): save VERSION=3 for enrollment state"
```

---

## Task 6: University screen (enroll / study)

**Files:**
- Create: `game/ui/screens/EducationScreen.svelte`
- Modify: `game/ui/screens/BuildingScreen.svelte`

- [ ] **Step 1: Write `game/ui/screens/EducationScreen.svelte`**

```svelte
<!-- game/ui/screens/EducationScreen.svelte -->
<script lang="ts">
  import { gameStore } from "../stores/game.svelte";
  import { COURSES } from "../../data/courses";
  import { CONFIG } from "../../data/config";
  import ActionRow from "./ActionRow.svelte";

  let { courseIds }: { courseIds: string[] } = $props();
  const player = $derived(gameStore.player);
  const enrolled = $derived(player.enrolledCourse ? COURSES[player.enrolledCourse] : null);
  const studyPreview = $derived(gameStore.preview({ type: "study" }));
</script>

{#if enrolled}
  <div class="enrolled">
    <div class="cur">Enrolled: <b>{enrolled.name}</b></div>
    <div class="prog">Progress: {player.courseProgress}/{CONFIG.studySessionsToGraduate} sessions</div>
    <button class="study" disabled={!studyPreview.ok}
      title={studyPreview.ok ? "" : (studyPreview.reason ?? "")}
      onclick={() => gameStore.dispatch({ type: "study" })}>
      Study ({enrolled.timeCost} time)
    </button>
  </div>
{:else}
  <p class="lead">Enroll in a course (one at a time):</p>
  {#each courseIds as id (id)}
    {@const c = COURSES[id]}
    {@const r = gameStore.preview({ type: "enroll", course: id })}
    <ActionRow name={c.name}
      sub={`${CONFIG.studySessionsToGraduate} study sessions → +${c.educationGain} Edu`}
      badges={[{ text: `⏳ ${c.timeCost}/study` }, { text: `$${c.cost} tuition`, kind: "cost" }]}
      disabled={!r.ok} reason={r.reason ?? ""} onact={() => gameStore.dispatch({ type: "enroll", course: id })} />
  {/each}
{/if}

<style>
  .lead { font-size: clamp(10px, 1.1vw, 12px); color: #555; margin: 0 0 6px; }
  .enrolled { background: #fff; border-radius: 6px; padding: 8px; color: #2a2f1a; }
  .cur { font-size: clamp(11px, 1.2vw, 14px); }
  .prog { font-size: clamp(10px, 1.1vw, 12px); color: #777; margin: 4px 0 8px; }
  .study { width: 100%; background: #4a90d9; color: #fff; border: none; border-radius: 6px; padding: 8px; font-size: clamp(11px, 1.2vw, 13px); font-weight: 700; cursor: pointer; }
  .study:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
```

- [ ] **Step 2: Use it in `BuildingScreen.svelte`**

In `game/ui/screens/BuildingScreen.svelte`, add an import (after the `import BankPanel ...` line):
```ts
  import EducationScreen from "./EducationScreen.svelte";
```
Then replace the entire `education` branch:
```svelte
    {:else if svc.kind === "education"}
      {#each svc.courseIds as id (id)}
        {@const c = COURSES[id]}
        {@const a = { type: "takeClass", course: id } as const}
        {@const d = dis(a)}
        <ActionRow name={c.name}
          badges={[{ text: `📘 +${c.educationGain}` }, { text: `⏳ ${c.timeCost}` }, { text: `$${c.cost}`, kind: "cost" }]}
          disabled={d.disabled} reason={d.reason} onact={() => gameStore.dispatch(a)} />
      {/each}
```
with:
```svelte
    {:else if svc.kind === "education"}
      <EducationScreen courseIds={svc.courseIds} />
```

- [ ] **Step 3: Typecheck + commit**

Run: `bun run ui:check`
Expected: 0 errors. (`COURSES` may now be unused in `BuildingScreen.svelte` — that import is removed in Task 7 along with `CONFIG`; if svelte-check flags it here, proceed — it is cleaned in Task 7. If it errors rather than warns, remove the `COURSES` import now.)

```bash
git add game/ui/screens/EducationScreen.svelte game/ui/screens/BuildingScreen.svelte
git commit -m "feat(ui): University enroll/study screen"
```

---

## Task 7: Two-level Employment Office (HiringScreen)

**Files:**
- Create: `game/ui/screens/HiringScreen.svelte`
- Modify: `game/ui/screens/BuildingScreen.svelte`

- [ ] **Step 1: Write `game/ui/screens/HiringScreen.svelte`**

```svelte
<!-- game/ui/screens/HiringScreen.svelte -->
<script lang="ts">
  import { gameStore } from "../stores/game.svelte";
  import { WORLD } from "../../data/world";
  import { JOBS } from "../../data/jobs";
  import { CONFIG } from "../../data/config";
  import ActionRow from "./ActionRow.svelte";

  let { jobIds }: { jobIds: string[] } = $props();

  // Group the offered jobs by the building that employs them.
  const employers = $derived.by(() => {
    const ids = [...new Set(jobIds.map((j) => JOBS[j].buildingId))];
    return ids.map((bid) => ({
      id: bid,
      name: WORLD.buildings.find((b) => b.id === bid)?.name ?? bid,
      jobs: jobIds.filter((j) => JOBS[j].buildingId === bid),
    }));
  });

  let selected = $state<string | null>(null);
  const current = $derived(employers.find((e) => e.id === selected) ?? null);
</script>

{#if !current}
  <p class="lead">Pick an employer:</p>
  {#each employers as e (e.id)}
    <button class="employer" onclick={() => (selected = e.id)}>
      <span class="nm">{e.name}</span>
      <span class="cnt">{e.jobs.length} opening{e.jobs.length === 1 ? "" : "s"} ▸</span>
    </button>
  {/each}
{:else}
  <div class="subhd">
    <span class="nm">{current.name}</span>
    <button class="back" onclick={() => (selected = null)}>◂ Employers</button>
  </div>
  {#each current.jobs as id (id)}
    {@const job = JOBS[id]}
    {@const r = gameStore.preview({ type: "applyForJob", job: id })}
    <ActionRow name={`Apply: ${job.title}`}
      sub={job.requiredEducation > 0 ? `needs Edu ${job.requiredEducation}` : "no requirements"}
      badges={[{ text: `💵 $${job.wage}/shift` }, { text: `⏳ ${CONFIG.applyJobTimeCost}` }]}
      disabled={!r.ok} reason={r.reason ?? ""} onact={() => gameStore.dispatch({ type: "applyForJob", job: id })} />
  {/each}
{/if}

<style>
  .lead { font-size: clamp(10px, 1.1vw, 12px); color: #555; margin: 0 0 6px; }
  .employer { display: flex; align-items: center; justify-content: space-between; width: 100%; text-align: left;
    background: #fff; border: none; border-radius: 6px; padding: 7px 8px; margin-bottom: 5px; cursor: pointer; }
  .employer .nm { font-size: clamp(11px, 1.2vw, 13px); font-weight: 600; color: #2a2f1a; }
  .employer .cnt { font-size: clamp(9px, 1vw, 11px); color: #4a90d9; }
  .subhd { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
  .subhd .nm { font-size: clamp(11px, 1.2vw, 13px); font-weight: 700; color: #2a2f1a; }
  .back { background: none; border: none; font-size: clamp(10px, 1.1vw, 12px); color: #4a90d9; cursor: pointer; }
</style>
```

- [ ] **Step 2: Use it in `BuildingScreen.svelte` + drop unused imports**

In `game/ui/screens/BuildingScreen.svelte`:

(a) Add an import (after the `import EducationScreen ...` line from Task 6):
```ts
  import HiringScreen from "./HiringScreen.svelte";
```
(b) Replace the entire `hiring` branch:
```svelte
    {:else if svc.kind === "hiring"}
      {#each svc.jobIds as id (id)}
        {@const job = JOBS[id]}
        {@const a = { type: "applyForJob", job: id } as const}
        {@const d = dis(a)}
        <ActionRow name={`Apply: ${job.title}`}
          sub={job.requiredEducation > 0 ? `needs Edu ${job.requiredEducation}` : "no requirements"}
          badges={[{ text: `💵 $${job.wage}/shift` }, { text: `⏳ ${CONFIG.applyJobTimeCost}` }]}
          disabled={d.disabled} reason={d.reason} onact={() => gameStore.dispatch(a)} />
      {/each}
```
with:
```svelte
    {:else if svc.kind === "hiring"}
      <HiringScreen jobIds={svc.jobIds} />
```
(c) Now `COURSES` and `CONFIG` are no longer referenced in `BuildingScreen.svelte`. Remove their import lines:
```ts
  import { COURSES } from "../../data/courses";
  import { CONFIG } from "../../data/config";
```
(Keep the `JOBS`, `ITEMS`, `HOUSING`, and `wageFor` imports — still used by the workplace/shop/housing branches.)

- [ ] **Step 3: Typecheck + commit**

Run: `bun run ui:check`
Expected: 0 errors (no unused-import warnings; `COURSES`/`CONFIG` removed, `JOBS` still used by `myJobHere`).

```bash
git add game/ui/screens/HiringScreen.svelte game/ui/screens/BuildingScreen.svelte
git commit -m "feat(ui): two-level Employment Office (employers → openings)"
```

---

## Task 8: Full verification

- [ ] **Step 1: Engine suite + typecheck**

Run: `bun test`
Expected: PASS — all tests (enroll + study + rewritten integration tests), 0 fail.

Run: `bunx tsc --noEmit -p tsconfig.json`
Expected: clean.

- [ ] **Step 2: UI typecheck + build**

Run: `bun run ui:check && bun run ui:build`
Expected: 0 errors; build succeeds.

- [ ] **Step 3: Run the app and verify**

Run: `bun run ui:dev`, open http://localhost:5173, start a game (Easy preset), and verify:
- **University:** click University → see the course list with "3 study sessions → +N Edu" and a "$X tuition" badge. Enroll in **Adult Basics** → the screen flips to the enrolled view ("Progress: 0/3") with a **Study** button. Click **Study** three times → progress 1/3 → 2/3 → graduates (returns to the course list), and the HUD Education bar climbs to +20 across the three studies. Trying to enroll in a second course while enrolled is blocked (rows greyed).
- **Employment Office:** click it → a **list of employers** (e.g. "Factory — 2 openings", "Try and Save — 1 opening"). Pick one → its **openings** appear with an "◂ Employers" back link. Apply for a job you qualify for; one needing more education is greyed with a reason.
- The rest of the game still plays (work/shop/bank/rent/End Week/win) as before.
- Reload → a pre-6b (v2) save is discarded and you get fresh goal-setup; a fresh game resumes normally.

- [ ] **Step 4: Final commit (only if verification required fixes)**

```bash
git add -A
git commit -m "chore: Plan 6b verification fixes"
```
(Skip if nothing changed.)

---

## Self-Review (completed during planning)

**Spec coverage (Mechanics 3 & 7):**
- M3 enroll/study/graduate, one-at-a-time → Tasks 1 (state) + 2 (enroll) + 3 (study) + 6 (UI). `studySessionsToGraduate=3` config in Task 1. Telescoping education ensures the total equals `educationGain` exactly.
- M7 two-level Employment Office → Task 7 (HiringScreen, UI-only; reducer hiring unchanged).
- `takeClass` removal + test migration → Task 4. Save shape → Task 5.
- (Clothing gate on study — "can't study while naked" — is **Plan 6c**, not here; `study` gets that guard when clothing lands.)

**Placeholder scan:** none — every code step has complete code. Task 6 Step 3 notes a possible transient unused-import that Task 7 removes; that's an ordering note, not a placeholder.

**Type consistency:** `EnrollAction {type:"enroll";course:CourseId}` / `StudyAction {type:"study"}` defined in Tasks 2/3, registered in the reducer union+switch, consumed by `EducationScreen` (Task 6) via `gameStore.dispatch`/`preview`. `Player.enrolledCourse`/`courseProgress` defined Task 1, read by `study` (Task 3) and `EducationScreen` (Task 6). `CONFIG.studySessionsToGraduate` defined Task 1, used in Task 3 + Task 6. `HiringScreen` (Task 7) uses the unchanged `applyForJob` action and `JOBS[id].buildingId`/`WORLD.buildings`. No `takeClass` references remain after Task 4 (verified by tsc in Task 4 Step 5 and Task 8).

**Green-at-each-commit:** Tasks 1–3 add new code while `takeClass` still exists (build stays green); Task 4 removes `takeClass` and fixes its only consumers (reducer + the two integration tests) in one commit. UI Tasks 6/7 each end with `ui:check` clean; the `COURSES`/`CONFIG` import cleanup is bundled into Task 7 where the last use is removed.
