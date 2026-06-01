// game/engine/tests/market.test.ts
import { test, expect } from "bun:test";
import { weeklyDeal, salePrice } from "../market";
import { CONFIG } from "../../data/config";

const POOL = ["tv", "stereo", "suit", "casual"];

test("weeklyDeal is deterministic for the same inputs", () => {
  expect(weeklyDeal(7, 5, POOL)).toEqual(weeklyDeal(7, 5, POOL));
});

test("the deal item comes from the store's pool, percent from the config set", () => {
  for (let w = 1; w <= 50; w++) {
    const d = weeklyDeal(7, w, POOL)!;
    expect(POOL).toContain(d.item);
    expect((CONFIG.discountPercents as readonly number[]).includes(d.percent)).toBe(true);
  }
});

test("the special rotates — more than one item and percent show up over time", () => {
  const items = new Set<string>();
  const pcts = new Set<number>();
  for (let w = 1; w <= 60; w++) {
    const d = weeklyDeal(7, w, POOL)!;
    items.add(d.item); pcts.add(d.percent);
  }
  expect(items.size).toBeGreaterThan(1);
  expect(pcts.size).toBeGreaterThan(1);
});

test("an empty pool yields no deal", () => {
  expect(weeklyDeal(7, 1, [])).toBeNull();
});

test("salePrice takes the percentage off", () => {
  expect(salePrice(200, 25)).toBe(150);
  expect(salePrice(100, 40)).toBe(60);
});
