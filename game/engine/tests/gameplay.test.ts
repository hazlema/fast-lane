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
import { ITEMS } from "../../data/items";
import { weeklyDeal, salePrice } from "../market";

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

// — Try and Save: groceries, newspaper, lottery —————————————————————————

test("with a fridge, a frozen 8-pack keeps you fed for weeks without buying again", () => {
  let g = start({ cash: 999, inventory: ["fridge"] }, "tryandsave"); // fridge keeps them fresh
  g = act(g, { type: "buy", item: "burger8" }).state;
  expect(you(g).mealsStocked).toBe(8);
  g = act(g, { type: "endWeek" }).state; // no fresh meal → cook a frozen one
  expect(you(g).hungry).toBe(false);
  expect(you(g).sick).toBe(false);
  expect(you(g).mealsStocked).toBe(7);
  expect(g.log.some((e) => /cooked a frozen/i.test(e.text))).toBe(true); // the flavor we love
});

test("without a fridge, frozen burgers spoil and give you food poisoning + a bill", () => {
  let g = start({ cash: 999 }, "tryandsave"); // no fridge
  g = act(g, { type: "buy", item: "burger8" }).state;
  const cashBefore = you(g).cash;
  g = act(g, { type: "endWeek" }).state; // spoils → sick → doctor bill
  expect(you(g).mealsStocked).toBe(0);          // nothing keeps without a fridge
  expect(you(g).sick).toBe(true);
  expect(you(g).sickWeeks).toBeGreaterThan(0);
  expect(you(g).cash).toBe(cashBefore - CONFIG.doctorBill); // doctor billed
  expect(g.log.some((e) => /spoiled|sick/i.test(e.text))).toBe(true);
});

test("sickness docks time, then you recover after sicknessWeeks", () => {
  // sick going in; a fridge + stock keeps you fed so ONLY sickness docks time.
  let g = start({ sickWeeks: CONFIG.sicknessWeeks, inventory: ["fridge"], mealsStocked: 5 }, "lowcost");
  g = act(g, { type: "endWeek" }).state; // first recovery week
  expect(you(g).sick).toBe(true);
  expect(you(g).timeLeft).toBe(CONFIG.weeklyTimeBudget - CONFIG.sicknessTimePenalty);
  for (let i = 0; i < CONFIG.sicknessWeeks; i++) g = act(g, { type: "endWeek" }).state;
  expect(you(g).sick).toBe(false);
  expect(you(g).sickWeeks).toBe(0);
});

test("a newspaper lifts happiness and prints a headline", () => {
  let g = start({ cash: 999, happiness: 0 }, "tryandsave");
  g = act(g, { type: "buy", item: "newspaper" }).state;
  expect(you(g).happiness).toBe(2);
  expect(g.log.some((e) => /📰/.test(e.text))).toBe(true);
});

test("a lottery ticket is drawn next turn (win or lose) and consumed", () => {
  let g = start({ cash: 999 }, "tryandsave");
  g = act(g, { type: "buy", item: "lottery" }).state;
  expect(you(g).lotteryTicket).toBe(true);
  g = act(g, { type: "endWeek" }).state;
  expect(you(g).lotteryTicket).toBe(false); // consumed at the draw
  expect(g.log.some((e) => /lottery/i.test(e.text))).toBe(true);
});

// — Clothing ————————————————————————————————————————————————————————————

test("casual clothes are a cheaper way to stay clothed", () => {
  let g = start({ clothingWear: CONFIG.clothingLastsWeeks, cash: 999 }, "offrack");
  g = act(g, { type: "buy", item: "casual" }).state;
  expect(you(g).clothingWear).toBe(0);
});


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

// — Home: relax & the High Security perk ———————————————————————————————

test("relaxing at home lifts happiness and costs a time unit", () => {
  let g = start({ happiness: 0 }, "lowcost"); // you rent Low Cost Housing
  const t = you(g).timeLeft;
  g = act(g, { type: "relax" }).state;
  expect(you(g).happiness).toBe(CONFIG.relaxHappiness);
  expect(you(g).timeLeft).toBe(t - 1);
});

test("a TV makes relaxing at home more enjoyable", () => {
  const g = act(start({ happiness: 0, inventory: ["tv"] }, "lowcost"), { type: "relax" }).state;
  expect(you(g).happiness).toBe(CONFIG.relaxHappiness + CONFIG.relaxTvBonus);
});

test("you can NOT relax at a home you don't rent", () => {
  const r = act(start({ housingId: "lowcost" }, "highsec"), { type: "relax" });
  expect(r.ok).toBe(false);
  expect(r.reason).toMatch(/don't live here/i);
});

test("living in High Security gives a weekly happiness bonus", () => {
  // seed 2 → a quiet week-1 weekend, isolating the perk from weekend events.
  let g = { ...start({ housingId: "highsec", happiness: 100 }, "highsec"), seed: 2 };
  g = act(g, { type: "endWeek" }).state;
  // −happinessDecayPerWeek, +highSecHappiness
  expect(you(g).happiness).toBe(100 - CONFIG.happinessDecayPerWeek + CONFIG.highSecHappiness);
  expect(g.log.some((e) => /High Security/i.test(e.text))).toBe(true);
});

// — Pawn shop & Electronics ————————————————————————————————————————————

test("the pawn shop buys a durable back for half its cost", () => {
  let g = start({ inventory: ["tv"], cash: 0 }, "pawn");
  g = act(g, { type: "sell", item: "tv" }).state;
  expect(you(g).cash).toBe(Math.round(ITEMS.tv.cost * CONFIG.pawnSellFraction));
  expect(you(g).inventory).not.toContain("tv");
});

test("the pawn shop will NOT buy food", () => {
  const r = act(start({ inventory: ["burger"] }, "pawn"), { type: "sell", item: "burger" });
  expect(r.ok).toBe(false);
  expect(r.reason).toMatch(/won't buy/i);
});

// — Weekend plans (books & concert tickets) ———————————————————————————

test("a concert ticket is enjoyed over the weekend — happiness up, some cash spent there", () => {
  // seed 2 → a quiet week-1 weekend, isolating the plan from random events.
  let g = { ...start({ happiness: 50, cash: 200, inventory: ["concert"] }), seed: 2 };
  g = act(g, { type: "endWeek" }).state;
  const plan = ITEMS.concert.weekend!;
  expect(you(g).happiness).toBe(50 - CONFIG.happinessDecayPerWeek + plan.happiness);
  expect(you(g).inventory).not.toContain("concert");
  const spent = 200 - you(g).cash;
  expect(spent).toBeGreaterThanOrEqual(plan.spendMin);
  expect(spent).toBeLessThanOrEqual(plan.spendMax);
  expect(g.log.some((e) => /concert/i.test(e.text) && e.text.includes(`$${spent}`))).toBe(true);
});

test("a book is read over the weekend — happiness up, nothing spent", () => {
  let g = { ...start({ happiness: 50, cash: 100, inventory: ["book"] }), seed: 2 };
  g = act(g, { type: "endWeek" }).state;
  expect(you(g).happiness).toBe(50 - CONFIG.happinessDecayPerWeek + ITEMS.book.weekend!.happiness);
  expect(you(g).cash).toBe(100);
  expect(you(g).inventory).not.toContain("book");
  expect(g.log.some((e) => /book/i.test(e.text))).toBe(true);
});

test("concert spending can't exceed the cash in your pocket", () => {
  let g = { ...start({ cash: 3, inventory: ["concert"] }), seed: 2 };
  g = act(g, { type: "endWeek" }).state;
  expect(you(g).cash).toBeGreaterThanOrEqual(0);
});

test("a book and a concert ticket both pay off in the same weekend", () => {
  let g = { ...start({ happiness: 0, cash: 500, inventory: ["book", "concert"] }), seed: 2 };
  g = act(g, { type: "endWeek" }).state;
  // decay floors at 0, then both plans land
  expect(you(g).happiness).toBe(ITEMS.book.weekend!.happiness + ITEMS.concert.weekend!.happiness);
  expect(you(g).inventory).toEqual([]);
});

test("the pawn shop sells used books; the discount store sells books and concert tickets", () => {
  let g = act(start({ cash: 100 }, "pawn"), { type: "buy", item: "book" }).state;
  expect(you(g).inventory).toContain("book");
  let d = start({ cash: 100 }, "discount");
  d = act(d, { type: "buy", item: "concert" }).state;
  expect(you(d).inventory).toContain("concert");
});

test("Electronics sells a fridge — the 6d spoilage hook", () => {
  let g = start({ cash: 9999 }, "electronics");
  g = act(g, { type: "buy", item: "fridge" }).state;
  expect(you(g).inventory).toContain("fridge");
});

test("you can't buy a second fridge — durables are one per customer", () => {
  const r = act(start({ cash: 99999, inventory: ["fridge"] }, "electronics"), { type: "buy", item: "fridge" });
  expect(r.ok).toBe(false);
  expect(r.reason).toMatch(/already own/i);
});

// — Weekend events —————————————————————————————————————————————————————

test("weekends bring the occasional event to the news", () => {
  let g = start({ housingId: null, cash: 500, happiness: 0 }); // no rent → no eviction noise
  for (let i = 0; i < 20; i++) g = act(g, { type: "endWeek" }).state;
  expect(g.log.some((e) => /^[🚨🎵💰]/u.test(e.text))).toBe(true);
});

test("living in High Security means you're never mugged", () => {
  let g = start({ housingId: "highsec", cash: 500 });
  for (let i = 0; i < 15 && g.phase === "playing"; i++) {
    if (you(g).rentDue > 0) {
      g = { ...g, players: [{ ...you(g), position: "rentoffice", cash: 9999 }] };
      g = act(g, { type: "payRent" }).state;
    }
    g = act(g, { type: "endWeek" }).state;
  }
  expect(g.log.some((e) => e.text.startsWith("🚨"))).toBe(false);
});

// — Discount Store weekly special ——————————————————————————————————————

// Must mirror the discount building's shop itemIds (the deal rolls over them).
const DISCOUNT_POOL = ["tv", "stereo", "suit", "casual", "book", "concert"];

test("the Discount Store's weekly special is cheaper there", () => {
  let g = start({ cash: 99999 }, "discount");
  const deal = weeklyDeal(g.seed, g.week, DISCOUNT_POOL)!;
  const before = you(g).cash;
  g = act(g, { type: "buy", item: deal.item }).state;
  const paid = before - you(g).cash;
  expect(paid).toBe(salePrice(ITEMS[deal.item].cost, deal.percent));
  expect(paid).toBeLessThan(ITEMS[deal.item].cost);
});

test("only the special is discounted — other items are full price", () => {
  const g = start({ cash: 99999 }, "discount");
  const deal = weeklyDeal(g.seed, g.week, DISCOUNT_POOL)!;
  const other = DISCOUNT_POOL.find((id) => id !== deal.item)!;
  const before = you(g).cash;
  const g2 = act(g, { type: "buy", item: other }).state;
  expect(before - you(g2).cash).toBe(ITEMS[other].cost); // full price
});

// — Tesla: free travel + robotaxi income ———————————————————————————————

test("a Tesla makes travel free — trips cost no time", () => {
  let g = start({ inventory: ["tesla"] }, "lowcost");
  const t = you(g).timeLeft;
  g = act(g, { type: "moveTo", node: "bank" }).state; // a multi-hop trip
  expect(you(g).timeLeft).toBe(t); // 0 time charged
});

test("without a Tesla, travel still costs time", () => {
  let g = start({}, "lowcost");
  const t = you(g).timeLeft;
  g = act(g, { type: "moveTo", node: "bank" }).state;
  expect(you(g).timeLeft).toBeLessThan(t);
});

test("the Tesla dealership sells a Tesla to a well-paid worker", () => {
  let g = start({ jobId: "broker", cash: 9999 }, "dealership"); // broker pays well
  g = act(g, { type: "buy", item: "tesla" }).state;
  expect(you(g).inventory).toContain("tesla");
});

test("the dealership won't finance a burger flipper", () => {
  const r = act(start({ jobId: "cook", cash: 9999 }, "dealership"), { type: "buy", item: "tesla" });
  expect(r.ok).toBe(false);
  expect(r.reason).toMatch(/job|finance/i);
});

test("a Tesla earns weekend robotaxi income", () => {
  let g = start({ inventory: ["tesla"], housingId: null }, "lowcost"); // no rent noise
  const cash = you(g).cash;
  g = act(g, { type: "endWeek" }).state;
  expect(you(g).cash).toBe(cash + CONFIG.teslaIncome);
  expect(g.log.some((e) => /Tesla earned/i.test(e.text))).toBe(true);
});

// — Housing / leases ———————————————————————————————————————————————————

test("you can move into a different unit at the Rent Office", () => {
  const r = act(start({ housingId: "lowcost" }, "rentoffice"), { type: "rent", unit: "highsec" });
  expect(r.ok).toBe(true);
  expect(you(r.state).housingId).toBe("highsec");
});

test("you can't re-sign the lease you already hold", () => {
  const r = act(start({ housingId: "lowcost" }, "rentoffice"), { type: "rent", unit: "lowcost" });
  expect(r.ok).toBe(false);
  expect(r.reason).toMatch(/already live/i);
});

// — Computer side-income ———————————————————————————————————————————————

test("a computer earns passive income each week", () => {
  let g = start({ inventory: ["computer"], housingId: null }, "lowcost"); // no rent noise
  const cashBefore = you(g).cash;
  g = act(g, { type: "endWeek" }).state;
  expect(you(g).cash).toBe(cashBefore + CONFIG.computerIncome);
  expect(g.log.some((e) => /computer brought in/i.test(e.text))).toBe(true);
});

test("no computer, no passive income", () => {
  let g = start({ housingId: null }, "lowcost");
  const cashBefore = you(g).cash;
  g = act(g, { type: "endWeek" }).state;
  expect(you(g).cash).toBe(cashBefore); // unchanged (no interest/income sources)
});

// — Economic crisis ————————————————————————————————————————————————————

test("a deep economic crisis hits the employed (layoff or pay-cut)", () => {
  let g = start({ jobId: "janitor", careerLevel: 3, housingId: null }, "factory"); // no rent noise
  g = { ...g, economyIndex: CONFIG.indexFloor }; // deflationary crisis (walk stays ≤ crisisLowBand)
  let hit = false;
  for (let i = 0; i < 4 && !hit; i++) {
    g = act(g, { type: "endWeek" }).state;
    if (g.log.some((e) => /laid off|pay grade/i.test(e.text))) hit = true;
  }
  expect(hit).toBe(true);
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

test("paying what you can each week keeps you housed — no eviction while paying", () => {
  // Rent outpaces your cash, so you only ever make partial payments — but you
  // pay something every week. A good-faith payer must NOT be evicted.
  let g = start({ housingId: "lowcost", inventory: ["fridge"], mealsStocked: 99 });
  for (let i = 0; i < 16 && g.phase === "playing"; i++) {
    if (you(g).rentDue > 0) {
      g = { ...g, players: [{ ...you(g), position: "rentoffice", cash: 30 }] }; // only $30 on hand
      g = act(g, { type: "payRent" }).state; // partial payment
    }
    g = act(g, { type: "endWeek" }).state;
  }
  expect(g.phase).toBe("playing"); // kept paying → never evicted
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
