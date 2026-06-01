// tools/sim/bot.ts
//
// A transparent heuristic player for balance simulation. decide() returns the
// single next Action given the current state. The harness applies it, then asks
// again — so movement is just "if I'm not where I need to be, moveTo; else act".
//
// Priority (survival first, then advancement, then optimisation):
//   eat → pay rent → replace worn clothes → get a job → study a degree →
//   upgrade to a better job → work → bank surplus → buy happiness → end week.
//
// `blocked` holds action signatures that were rejected THIS turn (e.g. a job
// with no opening, or a trip there's no time for); decide skips them and tries
// the next useful thing, ending the week when nothing's left.
import type { GameState } from "../../game/engine/state";
import type { World } from "../../game/engine/world";
import type { Action } from "../../game/engine/reducer";
import type { Building } from "../../game/data/buildings";
import type { Item } from "../../game/data/items";
import { isFed, isClothed, isEmployed, isQualifiedFor } from "../../game/engine/checks";
import { CONFIG } from "../../game/data/config";

export function sig(a: Action): string {
  return JSON.stringify(a);
}

const findService = (w: World, kind: string): Building | undefined =>
  w.buildings.find((b) => b.services.some((s) => s.kind === kind));

// First building whose shop sells an item matching pred.
function shopFor(w: World, pred: (it: Item) => boolean): Building | undefined {
  return w.buildings.find((b) =>
    b.services.some((s) => s.kind === "shop" && s.itemIds.some((id) => pred(w.items[id]))));
}

// Cheapest item a building sells matching pred (by base cost).
function cheapestAt(b: Building | undefined, w: World, pred: (it: Item) => boolean): string | undefined {
  const shop = b?.services.find((s) => s.kind === "shop");
  const ids = (shop?.kind === "shop" ? shop.itemIds : []).filter((id) => pred(w.items[id]));
  ids.sort((x, y) => w.items[x].cost - w.items[y].cost);
  return ids[0];
}

// Best-paying job the player currently qualifies for.
function bestQualifiedJob(state: GameState, w: World): string | undefined {
  const me = state.players[state.current];
  return Object.values(w.jobs)
    .filter((j) => isQualifiedFor(me, j))
    .sort((a, b) => b.wage - a.wage)[0]?.id;
}

// An available degree to pursue: prereqs met, not yet earned, affordable.
function nextDegree(state: GameState, w: World): string | undefined {
  const me = state.players[state.current];
  return Object.values(w.courses)
    .filter((c) =>
      !me.completedCourses.includes(c.id) &&
      c.requires.every((r) => me.completedCourses.includes(r)) &&
      me.cash >= c.cost)
    .sort((a, b) => a.cost - b.cost)[0]?.id;
}

export function decide(state: GameState, world: World, blocked: Set<string> = new Set()): Action {
  const me = state.players[state.current];
  const goals = state.goals;
  const here = me.position;

  // Propose an action: travel to `node` first if we're not there, else `act`.
  // Returns null if the proposed action (or the required trip) is blocked.
  const go = (node: string | undefined, act: Action): Action | null => {
    if (node == null) return null;
    const step: Action = here === node ? act : { type: "moveTo", node };
    return blocked.has(sig(step)) ? null : step;
  };

  const food = shopFor(world, (it) => it.food);
  const clothier = shopFor(world, (it) => it.clothing);
  const employment = findService(world, "hiring");
  const university = findService(world, "education");
  const bankB = findService(world, "bank");
  const rentOffice = findService(world, "housing");
  const home = world.buildings.find((b) => b.id === me.housingId);

  const candidates: (Action | null)[] = [];

  // 1. Eat — a fresh meal keeps the hunger penalty away (frozen stock auto-cooks).
  if (!isFed(me) && me.mealsStocked === 0) {
    const burger = cheapestAt(food, world, (it) => it.food);
    if (burger && me.cash >= world.items[burger].cost) candidates.push(go(food!.node, { type: "buy", item: burger }));
  }
  // 2. Pay rent (even partially) before it snowballs.
  if (me.rentDue > 0 && me.cash > 0) candidates.push(go(rentOffice?.node, { type: "payRent" }));
  // 3. Replace clothes before/at rags (rags block work & study).
  if (me.clothingWear >= CONFIG.clothingLastsWeeks - 1) {
    const clothes = cheapestAt(clothier, world, (it) => it.clothing);
    if (clothes && me.cash >= world.items[clothes].cost) candidates.push(go(clothier!.node, { type: "buy", item: clothes }));
  }
  // 4. Get a job if unemployed.
  if (!isEmployed(me)) {
    const job = bestQualifiedJob(state, world);
    if (job) candidates.push(go(employment?.node, { type: "applyForJob", job }));
  }
  // 5. Study toward the education goal (also unlocks better-paying jobs).
  if (me.education < goals.education) {
    if (me.enrolledCourse) candidates.push(go(university?.node, { type: "study" }));
    else {
      const course = nextDegree(state, world);
      if (course) candidates.push(go(university?.node, { type: "enroll", course }));
    }
  }
  // 6. Upgrade to a better-paying job once we qualify for one.
  if (isEmployed(me)) {
    const best = bestQualifiedJob(state, world);
    if (best && world.jobs[best].wage > world.jobs[me.jobId!].wage) {
      candidates.push(go(employment?.node, { type: "applyForJob", job: best }));
    }
  }
  // 7. Work — money + experience (→ promotions, career goal).
  if (isEmployed(me)) candidates.push(go(world.buildings.find((b) => b.id === world.jobs[me.jobId!].buildingId)?.node, { type: "work" }));
  // 8. Bank a surplus — mugger-safe and earns interest.
  if (me.cash > 300 && bankB) candidates.push(go(bankB.node, { type: "bank", op: "deposit", amount: me.cash - 100 }));
  // 9. Lift happiness toward its goal — relax at home (cheap, repeatable).
  if (me.happiness < goals.happiness && home) candidates.push(go(home.node, { type: "relax" }));

  return candidates.find((a) => a !== null) ?? { type: "endWeek" };
}
