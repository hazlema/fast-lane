# Jones Plan 6 — Gameplay Depth (Design)

**Date:** 2026-05-31
**Status:** Approved design, pre-plan
**Parent spec:** `2026-05-31-jones-game-design.md`
**Builds on:** Plans 1–5 (pure engine + real board + full Svelte UI + persistence), all merged to `main`.

## Summary

Plan 6 deepens the economic life-sim with a suite of interlocking systems on top of the now-playable game: a **week/month calendar** with auto-return-home and **monthly rent paid in person**; **university enrollment** (study toward graduation, one course at a time); a **hunger** rule (eat each week or lose time); **clothing** that gates jobs and wears out; **groceries + fridge** (with spoilage→sickness if unrefrigerated); a **data-driven store catalog** with a **rotating random Discount Store**; **seeded weekend random events** (concert nights out, computer freelance income, surprise doctor bills); and a **living economy** — a fluctuating inflation index that drives prices and rent up, drives wages inversely, and at extremes triggers rare recessions (pay cuts / layoffs). The engine stays pure and deterministic (all randomness flows through the existing seeded RNG); the UI keeps the dispatch-only contract.

Because this is a large, cohesive body of work, it is **decomposed into a sequence of independently shippable implementation plans** (see *Implementation Phasing*). This document is the shared design for all of them.

## Goals & Non-Goals

**Goals:**
- A calendar (week within a 4-week month), auto-return-home each week, monthly rent due and paid at the Rent Office.
- University enrollment + repeated study to graduate; one course at a time.
- Eat-or-time-penalty; food progression burger → groceries(+fridge).
- Clothing tiers (casual/dress) gating jobs, wearing out over months, with a "naked" lockout.
- Data-driven store catalogs (external JSON); rotating random Discount stock; always-available utility appliances.
- A living economy: a fluctuating seeded inflation index driving prices + rent up and wages inversely, with rare crisis-triggered pay cuts / layoffs.
- Seeded weekend random events: concert night-out, computer income, random doctor bill.
- Pure, deterministic engine with `bun test`; UI verified by running it.

**Non-Goals (deferred):**
- AI opponents / multiplayer (architecture still must not preclude).
- Item dependencies between appliances (e.g., VCR needing a TV) — every happiness item is independent for now.
- A physical doctor/hospital building — medical costs are automatic settlement charges.
- Graphics polish on the new screens (text + badges, like Plan 5).

## Calendar

- A **month = 4 weeks** (`CONFIG.weeksPerMonth = 4`). The current month is derived: `month = floor((week - 1) / 4) + 1`; `weekOfMonth = ((week - 1) % 4) + 1`.
- No new turn structure beyond the existing weekly cycle; "month" only governs rent due and inflation cadence.

## Mechanic 1 — Return home each week

- Each player has a **home node**, derived from `housingId` (the rented building's node). Players start renting **Low Cost Housing**, so home starts at `lowcost`.
- During `endWeek` settlement, after all charges, the player's `position` is set to their home node. **Free** (no travel time). The token snaps/animates home for the new week.
- Renting a different unit at the Rent Office moves home accordingly.

## Mechanic 2 — Monthly rent, paid at the Rent Office

- Rent is **monthly**, not weekly. Each housing unit has a **base monthly** figure (Low Cost = 40, High Security = 120; tunable). The amount charged is `round(baseRent × economyIndex)` — **rent inflates like store prices** (see Mechanic 10).
- At each month boundary (end of weeks 4, 8, 12, …), the month's rent (`round(baseRent × economyIndex)` at that moment) is **added to `player.rentDue`**. First charge lands at the end of week 4 (the opening stretch is grace).
- The player pays via a **Pay Rent** action at the **Rent Office** (the `housing` service gains a pay-rent op): pays `min(rentDue, cash)` from cash, reducing `rentDue`. Partial payment allowed.
- **Gentle failure:** unpaid `rentDue` simply persists (shown in HUD + news). No eviction in MVP. (Optionally it could accrue into debt later; out of scope now.)
- The weekly auto-rent deduction in `endWeek`/`settleRent` is **removed**.

## Mechanic 3 — University: enroll, then study to graduate

- New player state: `enrolledCourse: CourseId | null`, `courseProgress: number` (completed study sessions).
- **Enroll** (`enroll {course}`) at the University: requires no current enrollment; pays the course **tuition once** (catalog/course price); sets `enrolledCourse`, `courseProgress = 0`. Rejected if already enrolled, can't afford, or not at University.
- **Study** (`study {}`) at the University: requires being enrolled; costs the course's `timeCost`; increments `courseProgress`; grants partial education `round(course.educationGain / sessions)` each session.
- **Graduation:** after `CONFIG.studySessionsToGraduate = 3` study sessions, the final session tops education up to the exact `educationGain` total, then **clears** `enrolledCourse`/`courseProgress` — now free to enroll in another.
- Cannot be enrolled in two courses at once (enroll rejected while enrolled).
- Studying is blocked while "naked" (see Clothing).

## Mechanic 4 — Eat or lose time

- New player state: `ateThisWeek: boolean`.
- "Eating" = buying any **food** item during the week (burger, or groceries with a fridge — see M7). Buying food sets `ateThisWeek = true`.
- At `endWeek`: if `!ateThisWeek`, the upcoming week's time budget is reduced by `CONFIG.hungerTimePenalty = 5` (one-week penalty, does not stack). `ateThisWeek` resets to `false` each week.
- The player **starts week 1 fed** (`ateThisWeek = true`) so there's no immediate penalty.
- Surfaced in news: "You went hungry — −5 time next week."

## Mechanic 5 — Clothing: tiers, job gates, wear-out

- **Tiers:** `ClothingTier = "casual" | "dress"`, ordered `dress > casual` (owning fresh dress satisfies a casual requirement; casual does not satisfy a dress requirement).
- **State:** `clothingExpiry: { casual: number; dress: number }` — the week number through which each tier remains fresh (0 = none / never owned). A tier is **fresh** if `currentWeek <= clothingExpiry[tier]`.
- **Buying clothing** (a `buy` of an item with a `clothingTier`) sets `clothingExpiry[tier] = week + CONFIG.clothingLifespanWeeks` (12 weeks ≈ 3 months). Re-buying refreshes.
- **Naked** = no fresh clothing of any tier. While naked, **work and study/enroll are blocked** (reducer rejects; rows grey via `preview`).
- **Job gate:** each `Job` gains `requiredClothing: ClothingTier`. `work` requires fresh clothing of the job's tier or higher. Mapping: Janitor → casual, Store Clerk → casual, Engineer → dress (the professional/"manager-or-higher" tier). Tunable.
- **Items:** the existing **Suit** becomes `clothingTier: "dress"`; add **Casual Clothes** (`clothingTier: "casual"`, cheap), sold at Discount / Off the Rack. (Old `clothing: boolean` on Item is replaced by optional `clothingTier`.)
- **Warnings** in news when a worn tier expires ("Your clothes wore out — buy new ones").
- The player **starts with fresh casual clothing** (`clothingExpiry.casual = startWeek + lifespan`) so they can work day one.

## Mechanic 6 — Groceries, the fridge, and getting sick

- **Groceries** (food item) sold at **Try & Save**: a cheaper-per-week way to be fed than eating out.
- **Fridge** — a **utility appliance** (durable, owned once) sold at **Electronics** (expensive) and *sometimes* discounted at the Discount Store. Always available at Electronics.
- **With a fridge:** buying groceries feeds you for the week (`ateThisWeek = true`), no ill effect.
- **Without a fridge:** groceries spoil. The player does **not** get fed, and at `endWeek` they get **sick**: an automatic **doctor bill** (`CONFIG.spoiledGroceriesDoctorBill = 50`, paid from cash; shortfall → debt) **plus** a time penalty next week (`CONFIG.sicknessTimePenalty = 15`, which supersedes — does not stack with — the hunger penalty). News explains and points to Electronics.
- Tracked via `player.groceriesUnrefrigerated: boolean` set when groceries are bought without a fridge, consumed at settlement.

## Mechanic 7 — Hiring: pick employer, then openings (UI)

- The **Employment Office** becomes a **two-level** screen: it lists **employers** (the distinct buildings that own the offered jobs); selecting an employer shows that employer's **openings**, where you apply.
- **Reducer is unchanged** — `applyForJob {job}` still validates the job is offered at the hiring building and the player meets requirements. This is purely a UI navigation change over the existing `hiring` service's `jobIds`.

## Mechanic 8 — Data-driven, inflating store catalog + rotating Discount

- **External catalog JSON** (`game/data/store-catalog.json`): per store, a list of `{ item: ItemId, basePrice: number, always?: boolean }`. Defines the *possible* stock and base prices. Item *attributes* (happiness, food, `clothingTier`, `durable`, `utility`) stay in the typed `ITEMS` table; **price moves to the catalog** (the `cost` field leaves `ITEMS`).
- **Inflation:** prices are computed at stock time as `round(basePrice * economyIndex)`, where `economyIndex` is the fluctuating economic index defined in **Mechanic 10** (it drifts up *and* down over the game, not monotonically).
- **Store kinds:**
  - **Fixed stores** (Electronics, Try & Save, Off the Rack, Frosty, Pawn): every catalog item is always offered, priced at base × inflation.
  - **Rotating store** (Discount): each week it stocks a **random subset** of `CONFIG.discountStockCount = 3` items drawn (seeded) from its catalog, **plus** any `always` items; some rolled items get a random markdown. The current offers are stored in `GameState.market: { item, price }[]`, re-rolled at `endWeek` (and at game start) from the RNG (`mulberry32(seed + week)`), so it is deterministic, testable, and survives save/reload.
  - **Always-available utility:** **fridge** and **computer** are flagged `always` at Electronics so they are never rotated out (utility, not just a happiness bump). They may also appear (discounted) in the Discount roll.
- **`buy` pricing:** at a fixed store the price is computed from the catalog × the current `economyIndex`; at the Discount Store the price is the one stored in `market` (already index-adjusted and possibly marked down). The `buy` action validates the item is offered at the current building and charges the correct price.
- **New items:** `groceries` (food), `casualclothes` (clothingTier casual), `book` (+happiness, cheap), `concert` (concert ticket — resolves at the weekend, see M9), `microwave`/`vcr` (durable, +happiness), `fridge` (durable, utility, small +happiness), `computer` (durable, utility, small +happiness). Existing `tv` stays (+happiness, durable), `suit` → dress clothing, `burger` → food.
- **Durables/ownership:** appliances (tv, vcr, microwave, fridge, computer) are owned once; tracked via `player.inventory` with an `owns(item)` helper (re-buying a durable is rejected/no-op). Consumables (burger, groceries, book, concert) give their effect and are not retained (except concert tickets, which are held until the weekend resolves them).

## Mechanic 9 — Seeded weekend random events

Fire during `endWeek` settlement (after deterministic charges, before time reset), all via `mulberry32(seed + week)` so they are deterministic and testable. Each appends a news line.

- **Concert night-out:** if the player holds a concert ticket, that weekend they go out — pay a random night-out cost (`concertNightOut` $20–60), gain happiness (`concertHappiness = 30`), and the ticket is consumed. (Buying the ticket does *not* grant happiness immediately; the weekend resolves it.)
- **Computer income:** if the player owns a computer, chance `computerIncomeChance = 0.4` to earn a random `computerIncome` ($50–150) freelancing.
- **Random doctor bill:** chance `doctorBillChance = 0.15` of a surprise medical bill (`doctorBill` $30–120; shortfall → debt). Independent of the deterministic grocery-spoilage sickness.

## Mechanic 10 — A living economy: fluctuating index, wages, and crises

- **The economy index** (`GameState.economyIndex`, starts `1.0`): a single seeded value driving all prices. Each `endWeek` it does a **bounded random walk** for the coming week: `economyIndex = clamp(economyIndex + step, CONFIG.indexFloor, CONFIG.indexCeil)` where `step ∈ [−CONFIG.indexStepMax, +CONFIG.indexStepMax]` drawn from `mulberry32(seed + week)`. Defaults: start `1.0`, `indexStepMax = 0.08`, `indexFloor = 0.5`, `indexCeil = 1.8`. So it drifts up and down within `[0.5, 1.8]` — no longer monotonic.
- **Prices scale with the index** (`price = round(basePrice × economyIndex)`): store items (M8) and **monthly rent** (M2).
- **Wages scale inversely** with the index: a work shift pays `round(baseWage × careerBonus × (1 / economyIndex) × (1 − payCut))`. **Inflation up ⇒ take-home down; inflation down ⇒ take-home up.** At index `1.0` this equals today's wage. (`wages.ts` gains the index + pay-cut factors.)
- **Economic crisis** — when `economyIndex ≥ CONFIG.crisisHigh` (`1.5`) or `≤ CONFIG.crisisLow` (`0.6`), the economy is in crisis. During a crisis weekend, an **employed** player faces a seeded chance `CONFIG.layoffChance` (`0.25`) of a job hit:
  - **Pay cut** — `player.payCut = CONFIG.payCutFactor` (`0.5`, halves wages). Persists until the economy returns to the normal band, then clears automatically.
  - **Fired** — `jobId = null` (and `careerLevel`/`experience` reset); the player must re-apply, and likely only qualifies for an entry "burger-flipper" job.
  - **Which one:** weighted by job quality — a **good job** (higher `requiredEducation` / `careerLevel`) is **more likely to take the pay cut** and rarely fired; a low-tier job is more likely **fired**. (Concretely: `P(fired)` scales down as the job's tier rises; defaults make engineers seldom fired, janitors often.)
  - Rare overall (only during out-of-band weeks, then a 1-in-4 roll). Logged in news ("Recession! Your hours were cut 50%." / "Layoffs hit — you lost your job.").
- **Recovery:** when `economyIndex` returns within `(crisisLow, crisisHigh)`, any active `payCut` clears (news: "The economy recovered — your pay is back to normal.").
- A subtle HUD indicator (e.g., a cost-of-living chip showing the index trend) is nice-to-have; the news lines are the primary signal.

## State & action changes (summary)

**`Player` additions:** `enrolledCourse`, `courseProgress`, `ateThisWeek`, `rentDue`, `clothingExpiry`, `groceriesUnrefrigerated`, `payCut` (0 normally; `0.5` during a pay-cut). (Existing `housingId` now starts as `"lowcost"`; `weeklyRent` is replaced by monthly handling via `rentDue` + the housing table's base monthly figure × index.)

**`GameState` additions:** `market: { item: ItemId; price: number }[]`, `economyIndex: number` (fluctuating inflation index, starts `1.0`). (Month is derived from `week`.)

**New / changed actions:**
- `enroll { course }`, `study {}` (replace the instant `takeClass`).
- `payRent {}` (pay `rentDue` at the Rent Office; pays `min(rentDue, cash)`).
- `buy { item }` — pricing now store/market-driven; sets `ateThisWeek`/`groceriesUnrefrigerated` for food; sets `clothingExpiry` for clothing; records durables; rejects duplicate durables.
- `work {}` — now also requires fresh clothing of the job's tier (and not naked).
- `applyForJob { job }` — unchanged in the reducer (UI two-level only).

**Settlement (`endWeek`) — new ordered pipeline:**
1. **Re-roll the economy index** (seeded) for the coming week; everything below uses the new value.
2. Bank/loan interest (unchanged).
3. **Month boundary:** if `week % 4 == 0`, `rentDue += round(baseRent × economyIndex)`.
4. **Grocery spoilage:** if `groceriesUnrefrigerated`, apply doctor bill (cash→debt) and mark sickness time penalty.
5. **Weekend random events** (seeded): concert resolve, computer income, random doctor bill; **economic crisis** layoff/pay-cut if the index is out of the normal band, and clear `payCut` if it returned to normal.
6. Promotion check (unchanged).
7. Happiness decay (unchanged).
8. **Return home:** `position = homeNode`.
9. **Time reset with penalties:** `timeLeft = weeklyTimeBudget − (sickness ? sicknessTimePenalty : (!ateThisWeek ? hungerTimePenalty : 0))`.
10. Reset per-week flags (`ateThisWeek = false`, `groceriesUnrefrigerated = false`); `week++`.
11. **Re-roll Discount market** for the new week (priced at the new index).
12. Win check (unchanged).

Each effect appends an itemized news line (extending the Plan 5 itemized log).

## Persistence & testing

- All new state is plain JSON and round-trips through the existing `save.ts` (bump the save `VERSION`; old saves discard cleanly — already handled by `deserialize`).
- The catalog JSON is bundled (imported), not persisted; only `market` (the rolled result) is in the save.
- **Engine-first TDD** (`bun test`): enrollment/study graduation, hunger/sickness penalties and ordering, clothing freshness/gating/naked-lockout, monthly rent accrual (× index) + pay, the seeded **economy-index walk** staying within bounds and being reproducible, **wages scaling inversely** to the index (and halved under `payCut`), **crisis layoff/pay-cut** outcomes weighted by job tier under a fixed seed, inflation pricing, deterministic Discount roll (same seed+week ⇒ same stock), and each weekend event under a fixed seed. UI verified by running it (`/run`, Playwright) as in Plan 5.

## Implementation Phasing (decomposition)

Each phase is an independently shippable implementation plan; later phases depend on earlier engine state. Final slicing is confirmed when each plan is written.

- **Plan 6a — Calendar, economy index, home, rent & wages:** week/month derivation; `economyIndex` (seeded, bounded random walk re-rolled each `endWeek`, starts 1.0); start renting Low Cost; return-home at `endWeek`; monthly `rentDue = round(baseRent × index)`; `payRent` at the Rent Office; **wages inverse to the index** (`wages.ts`); drop weekly auto-rent. Rent Office UI gains Pay-Rent + due balance; HUD shows month, rent due, and a cost-of-living indicator.
- **Plan 6b — University enroll/study & two-level hiring:** `enroll`/`study`, `courseProgress`, graduation; University enroll/study screen; Employment Office two-level employer→openings UI. (Reducer hiring unchanged.)
- **Plan 6c — Food, clothing & health:** `ateThisWeek` + hunger penalty; clothing tiers, job gates, wear-out, naked lockout; groceries + fridge + spoilage→sickness. Item-attribute changes; `work`/`study` gating; buy effects; HUD fed/clothing indicators.
- **Plan 6d — Catalog, market, appliances & weekend/crisis events:** external `store-catalog.json`; move pricing out of `ITEMS` (priced × index from 6a); rotating Discount `market` (seeded) + always-available appliances; new items (book/concert/microwave/vcr/computer/fridge); `buy` pricing rework; seeded weekend events (concert/computer/doctor) **and economic-crisis layoffs/pay-cuts** (consume the 6a index + jobs). Discount/Electronics UI; news lines.

(6a is foundational — it introduces the index that 6a-rent, 6a-wages, 6c-prices-via-buy, and 6d all consume. 6c depends on 6a's settlement pipeline; 6d depends on the item/`buy` groundwork in 6c. 6b is largely independent after 6a.)

## Open Decisions (defaults chosen; flag to change)

- Housing rent: base **monthly** figure in the housing table, **inflated** by the economy index when charged (`round(baseRent × economyIndex)`), like store prices.
- Spoilage sickness penalty **supersedes** (does not stack with) the hunger penalty in week-time math.
- Durable re-purchase is a no-op/reject (you can't own two fridges).
- Economy index walks within `[0.5, 1.8]` (step ≤ 0.08/wk); crisis bands at `≤0.6` / `≥1.5`; per-crisis-weekend layoff roll `0.25`; pay cut `0.5`; fired-vs-pay-cut weighted by job tier (good jobs rarely fired). All in `CONFIG`, freely tunable.
- Numbers above (penalties, chances, ranges, lifespan, sessions, index bounds) live in `CONFIG` and are freely tunable.
