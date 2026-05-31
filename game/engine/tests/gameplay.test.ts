// game/engine/tests/gameplay.test.ts
//
// Scenario tests: play the REAL board through the loop and assert the rules a
// player actually feels — "does skipping a meal cost me?", "can I walk into the
// factory and be hired as an Engineer with no experience?". These exercise
// loop + actions + real data together, so they catch rule regressions that
// per-function unit tests miss.
import { test, expect } from "bun:test";
import { newGame } from "../loop";
import { applyAction, type Action } from "../reducer";
import type { GameState, Player } from "../state";
import { WORLD } from "../../data/world";
import { CONFIG } from "../../data/config";

// A real-board game in "playing", with the player standing at `node` (node id
// === building id on the real board) and any fields overridden.
function start(over: Partial<Player> = {}, node = "lowcost"): GameState {
  let g = newGame({ playerName: "You", startNode: "lowcost", seed: 7, startHousing: "lowcost" });
  g = applyAction(g, { type: "setGoals", goals: g.goals }, WORLD).state; // → playing
  return { ...g, players: [{ ...g.players[0], position: node, ...over }] };
}

const act = (g: GameState, a: Action) => applyAction(g, a, WORLD);
const you = (g: GameState) => g.players[0];
const lastNews = (g: GameState) => g.log[g.log.length - 1]?.text ?? "";

// — Hunger ————————————————————————————————————————————————————————————

test("skip a meal and next week's time is docked", () => {
  let g = start(); // week 1: fed by the starting meal, but you don't eat this week
  g = act(g, { type: "endWeek" }).state;
  expect(you(g).timeLeft).toBe(CONFIG.weeklyTimeBudget - CONFIG.hungerTimePenalty);
  expect(you(g).hungry).toBe(true);
});

test("eat a burger and next week's time is full", () => {
  let g = start({}, "frosty"); // Frosty Burger sells burgers
  g = act(g, { type: "buy", item: "burger" }).state;
  expect(you(g).ateThisWeek).toBe(true);
  g = act(g, { type: "endWeek" }).state;
  expect(you(g).timeLeft).toBe(CONFIG.weeklyTimeBudget);
  expect(you(g).hungry).toBe(false);
});

// — Getting a job ——————————————————————————————————————————————————————

test("anyone gets hired as Fry Cook — entry job, always an opening", () => {
  let g = start({}, "employment");
  g = act(g, { type: "applyForJob", job: "cook" }).state;
  expect(you(g).jobId).toBe("cook");
  expect(lastNews(g)).toMatch(/hired/i);
});

test("you can NOT be hired as Engineer with no degrees", () => {
  let g = start({}, "employment");
  g = act(g, { type: "applyForJob", job: "engineer" }).state;
  expect(you(g).jobId).toBeNull();
  expect(lastNews(g)).toMatch(/not qualified/i);
});

test("you can NOT be hired as Engineer with the degrees but no work experience", () => {
  // Has both required degrees and the dependability, but zero experience.
  let g = start(
    { completedCourses: ["juniorcollege", "engineering"], experience: 0, dependability: 25 },
    "employment",
  );
  g = act(g, { type: "applyForJob", job: "engineer" }).state;
  expect(you(g).jobId).toBeNull(); // experience 0 < required 25
  expect(lastNews(g)).toMatch(/not qualified/i);
});

test("a fully-qualified Engineer applicant is never told 'not qualified' (hired, or no opening)", () => {
  let g = start(
    { completedCourses: ["juniorcollege", "engineering"], experience: 25, dependability: 25 },
    "employment",
  );
  g = act(g, { type: "applyForJob", job: "engineer" }).state;
  const hired = you(g).jobId === "engineer";
  const noOpening = /no openings/i.test(lastNews(g));
  expect(hired || noOpening).toBe(true);
  expect(lastNews(g)).not.toMatch(/not qualified/i);
});

// — Education tech tree ————————————————————————————————————————————————

test("you can NOT enroll in Engineering without the prerequisite chain", () => {
  const r = act(start({ cash: 1000 }, "university"), { type: "enroll", course: "engineering" });
  expect(r.ok).toBe(false);
  expect(r.reason).toMatch(/requires|degree/i);
});

test("with Trade School + Pre-Engineering done, you CAN enroll in Engineering", () => {
  const g = start({ completedCourses: ["tradeschool", "preeng"], cash: 1000 }, "university");
  const r = act(g, { type: "enroll", course: "engineering" });
  expect(r.ok).toBe(true);
  expect(you(r.state).enrolledCourse).toBe("engineering");
});

// — Clothing ————————————————————————————————————————————————————————————

test("in rags you can NOT work", () => {
  const g = start({ jobId: "janitor", clothingWear: CONFIG.clothingLastsWeeks }, "factory");
  const r = act(g, { type: "work" });
  expect(r.ok).toBe(false);
  expect(r.reason).toMatch(/rags|clothes/i);
});

test("in rags you can NOT study", () => {
  const g = start({ enrolledCourse: "juniorcollege", clothingWear: CONFIG.clothingLastsWeeks }, "university");
  const r = act(g, { type: "study" });
  expect(r.ok).toBe(false);
  expect(r.reason).toMatch(/rags|clothes/i);
});

test("buying clothes resets the wear and gets you back to work", () => {
  let g = start({ jobId: "janitor", clothingWear: CONFIG.clothingLastsWeeks, cash: 999 }, "offrack");
  g = act(g, { type: "buy", item: "suit" }).state; // Off the Rack sells suits
  expect(you(g).clothingWear).toBe(0);
  g = { ...g, players: [{ ...you(g), position: "factory" }] };
  expect(act(g, { type: "work" }).ok).toBe(true);
});

test("clothes age one week at a time", () => {
  let g = start({ housingId: null, clothingWear: 0 }); // no housing → no rent noise
  g = act(g, { type: "endWeek" }).state;
  expect(you(g).clothingWear).toBe(1);
});

// — Showing up for work ————————————————————————————————————————————————

test("an employee who never shows up gets fired", () => {
  let g = start({ jobId: "janitor" }, "factory");
  for (let i = 0; i <= CONFIG.fireAfterWeeks; i++) g = act(g, { type: "endWeek" }).state; // never work
  expect(you(g).jobId).toBeNull();
  expect(g.log.some((e) => /fired/i.test(e.text))).toBe(true);
});

// — Rent & eviction ————————————————————————————————————————————————————

test("never paying rent gets you evicted — game over", () => {
  let g = start({ housingId: "lowcost" }); // renting, but you never pay
  let guard = 0;
  while (g.phase === "playing" && guard++ < 30) g = act(g, { type: "endWeek" }).state;
  expect(g.phase).toBe("lost");
  expect(g.log.some((e) => /evict/i.test(e.text))).toBe(true);
});

test("paying the rent each time it's due keeps you housed", () => {
  let g = start({ housingId: "lowcost" });
  for (let i = 0; i < 12 && g.phase === "playing"; i++) {
    if (you(g).rentDue > 0) {
      g = { ...g, players: [{ ...you(g), position: "rentoffice", cash: 9999 }] };
      g = act(g, { type: "payRent" }).state;
    }
    g = act(g, { type: "endWeek" }).state;
  }
  expect(g.phase).toBe("playing"); // 12 weeks, rent always paid → never evicted
});

test("showing up every week keeps your job", () => {
  let g = start({ jobId: "janitor" }, "factory");
  for (let i = 0; i <= CONFIG.fireAfterWeeks; i++) {
    g = { ...g, players: [{ ...you(g), position: "factory" }] }; // back at work (endWeek sent you home)
    g = act(g, { type: "work" }).state;
    g = act(g, { type: "endWeek" }).state;
  }
  expect(you(g).jobId).toBe("janitor");
});
