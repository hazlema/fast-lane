<!-- game/ui/screens/BankPanel.svelte -->
<script lang="ts">
  import { gameStore } from "../stores/game.svelte";
  import type { BankOp } from "../../engine/actions/bank";

  const player = $derived(gameStore.player);
  const ops: { op: BankOp; label: string }[] = [
    { op: "deposit",  label: "Deposit"  },
    { op: "withdraw", label: "Withdraw" },
    { op: "loan",     label: "Take Loan" },
    { op: "repay",    label: "Repay"    },
  ];

  let amount = $state(50);
  const STEP = 50;
  function bump(dir: 1 | -1) { amount = Math.max(STEP, amount + dir * STEP); }

  function dis(op: BankOp) {
    const r = gameStore.preview({ type: "bank", op, amount });
    return { disabled: !r.ok, reason: r.reason ?? "" };
  }
</script>

<div class="bank">
  <div class="balances">
    <span>💵 ${player.cash}</span><span>🏦 ${player.bank}</span>
    {#if player.debt > 0}<span class="debt">📉 ${player.debt}</span>{/if}
  </div>

  <div class="amount">
    <button onclick={() => bump(-1)} aria-label="less">–</button>
    <span class="v">${amount}</span>
    <button onclick={() => bump(1)} aria-label="more">+</button>
  </div>

  <div class="ops">
    {#each ops as o (o.op)}
      {@const d = dis(o.op)}
      <button class="op" disabled={d.disabled} title={d.disabled ? d.reason : ""}
        onclick={() => gameStore.dispatch({ type: "bank", op: o.op, amount })}>{o.label}</button>
    {/each}
  </div>
</div>

<style>
  .bank { font-family: ui-sans-serif, system-ui, sans-serif; color: #2a2f1a; }
  .balances { display: flex; gap: 10px; font-size: clamp(10px, 1.1vw, 13px); margin-bottom: 8px; }
  .balances .debt { color: #c22; }
  .amount { display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 8px; }
  .amount button { width: 26px; height: 26px; border-radius: 6px; border: 1px solid #cdd9e8; background: #fff; color: #4a90d9; font-weight: 700; cursor: pointer; }
  .amount .v { font-size: clamp(13px, 1.5vw, 16px); font-weight: 700; min-width: 70px; text-align: center; }
  .ops { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
  .op { background: #4a90d9; color: #fff; border: none; border-radius: 6px; padding: 7px; font-size: clamp(10px, 1.1vw, 13px); font-weight: 700; cursor: pointer; }
  .op:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
