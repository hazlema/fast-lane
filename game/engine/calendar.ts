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
