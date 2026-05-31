// game/engine/actions/bank.ts
import type { GameState, Player } from "../state";
import type { World } from "../world";
import { type ApplyResult, ok, reject, updateCurrent } from "../result";
import { buildingAt, hasService } from "../../data/buildings";

export type BankOp = "deposit" | "withdraw" | "loan" | "repay";

export interface BankAction {
  type: "bank";
  op: BankOp;
  amount: number;
}

export function bank(state: GameState, action: BankAction, world: World): ApplyResult {
  if (state.phase !== "playing") return reject(state, "Can only bank while playing.");
  const player = state.players[state.current];
  const here = buildingAt(world.buildings, player.position);
  if (!here || !hasService(here, "bank")) return reject(state, "No bank here.");
  if (!(action.amount > 0)) return reject(state, "Amount must be positive.");

  const apply = (fn: (p: Player) => Player) => ok(updateCurrent(state, fn));

  switch (action.op) {
    case "deposit":
      if (action.amount > player.cash) return reject(state, "Not enough cash to deposit.");
      return apply((p) => ({ ...p, cash: p.cash - action.amount, bank: p.bank + action.amount }));
    case "withdraw":
      if (action.amount > player.bank) return reject(state, "Not enough funds in the bank.");
      return apply((p) => ({ ...p, bank: p.bank - action.amount, cash: p.cash + action.amount }));
    case "loan":
      return apply((p) => ({ ...p, cash: p.cash + action.amount, debt: p.debt + action.amount }));
    case "repay":
      if (action.amount > player.debt) return reject(state, "You don't owe that much debt.");
      if (action.amount > player.cash) return reject(state, "Not enough cash to repay that much.");
      return apply((p) => ({ ...p, cash: p.cash - action.amount, debt: p.debt - action.amount }));
    default: {
      const _exhaustive: never = action.op;
      return reject(state, `Unknown bank op: ${_exhaustive as string}`);
    }
  }
}
