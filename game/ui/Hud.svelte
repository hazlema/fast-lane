<script lang="ts">
  import { gameStore } from "./stores/game.svelte";
  import { wealthOf } from "../engine/winCheck";
  import { isClothed } from "../engine/checks";

  const player = $derived(gameStore.player);
  const month = $derived(gameStore.month);
  const rentDue = $derived(player.rentDue);
  const cost = $derived(gameStore.economyIndex); // 1.0 = normal cost of living
  const goals = $derived(gameStore.state.goals);
  const stats = $derived([
    { key: "wealth", label: "Wealth", val: wealthOf(player), goal: goals.wealth },
    { key: "happiness", label: "Happy", val: player.happiness, goal: goals.happiness },
    { key: "education", label: "Edu", val: player.education, goal: goals.education },
    { key: "career", label: "Career", val: player.careerLevel, goal: goals.career },
  ]);
  const pct = (v: number, g: number) => g <= 0 ? 100 : Math.min(100, Math.round((v / g) * 100));
</script>

<div class="hud">
  <div class="top">
    <span class="chip">Wk <b>{gameStore.state.week}</b> · M<b>{month}</b></span>
    <span class="chip" title="Cost of living (1.0 = normal)">📊 <b>{cost.toFixed(2)}</b></span>
    <span class="chip">⏳ <b>{player.timeLeft}</b></span>
    <span class="chip">💵 <b>${player.cash}</b></span>
    <span class="chip">🏦 <b>${player.bank}</b></span>
    {#if rentDue > 0}<span class="chip rent">🏠 <b>${rentDue}</b></span>{/if}
    {#if player.debt > 0}<span class="chip debt">📉 <b>${player.debt}</b></span>{/if}
    {#if player.hungry}<span class="chip hungry" title="You didn't eat last week — time is docked this week. Eat to avoid it next week.">🍴 <b>hungry</b></span>{/if}
    {#if !isClothed(player)}<span class="chip rags" title="Your clothes are worn out — buy new ones before you can work or study.">👕 <b>rags</b></span>{/if}
  </div>
  <div class="stats">
    {#each stats as s (s.key)}
      <div class="stat">
        <div class="lbl">{s.label} <span>{s.val}/{s.goal}</span></div>
        <div class="bar"><i style="width:{pct(s.val, s.goal)}%"></i></div>
      </div>
    {/each}
  </div>
  {#if gameStore.error}<div class="err">{gameStore.error}</div>{/if}
</div>

<style>
  .hud { font-family: ui-sans-serif, system-ui, sans-serif; color: #2a2f1a; display: flex; flex-direction: column; gap: 6px; padding: 8px; }
  .top { display: flex; gap: 6px; flex-wrap: wrap; }
  .chip { background: #fff; border-radius: 6px; padding: 3px 8px; font-size: clamp(9px, 1.1vw, 14px); }
  .chip b { color: #1a2412; }
  .chip.debt b { color: #c22; }
  .chip.rent b { color: #b8860b; }
  .chip.hungry { background: #fbeaea; } .chip.hungry b { color: #c22; }
  .chip.rags { background: #f3ecdb; } .chip.rags b { color: #b8860b; }
  .stats { display: flex; gap: 6px; }
  .stat { flex: 1; background: #fff; border-radius: 6px; padding: 4px 6px; }
  .lbl { font-size: clamp(8px, 0.9vw, 12px); color: #555; display: flex; justify-content: space-between; }
  .bar { height: 5px; background: #e3e3d8; border-radius: 3px; margin-top: 3px; overflow: hidden; }
  .bar i { display: block; height: 100%; background: #4a90d9; }
  .err { background: #fbe0e0; color: #a01; border-radius: 6px; padding: 4px 8px; font-size: 12px; }
</style>
