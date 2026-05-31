<!-- game/ui/screens/BuildingScreen.svelte -->
<script lang="ts">
  import { gameStore } from "../stores/game.svelte";
  import { WORLD } from "../../data/world";
  import { JOBS } from "../../data/jobs";
  import { ITEMS } from "../../data/items";
  import { HOUSING } from "../../data/housing";
  import { wageFor } from "../../engine/wages";
  import type { Action } from "../../engine/reducer";
  import ActionRow from "./ActionRow.svelte";
  import BankPanel from "./BankPanel.svelte";
  import EducationScreen from "./EducationScreen.svelte";
  import HiringScreen from "./HiringScreen.svelte";

  let { buildingId }: { buildingId: string } = $props();
  const building = $derived(WORLD.buildings.find((b) => b.id === buildingId));
  const player = $derived(gameStore.player);

  // Is the player's current job worked at this building?
  const myJobHere = $derived(
    player.jobId && JOBS[player.jobId]?.buildingId === buildingId ? JOBS[player.jobId] : null,
  );

  const dis = (a: Action) => { const r = gameStore.preview(a); return { disabled: !r.ok, reason: r.reason ?? "" }; };
</script>

<div class="screen">
  <div class="hd">
    <span class="t">{building?.name ?? "Building"}</span>
    <button class="back" onclick={() => gameStore.goHome()}>◂ Home</button>
  </div>

  {#if !building || building.services.length === 0}
    <p class="empty">Nothing to do here.</p>
  {/if}

  {#each building?.services ?? [] as svc (svc.kind)}
    {#if svc.kind === "workplace"}
      {#if myJobHere}
        {@const a = { type: "work" } as const}
        {@const d = dis(a)}
        <ActionRow name={`Work a shift — ${myJobHere.title}`}
          badges={[{ text: `💵 +$${wageFor(myJobHere, player.careerLevel, gameStore.economyIndex)}` }, { text: `⏳ ${myJobHere.timeCost}` }]}
          disabled={d.disabled} reason={d.reason} onact={() => gameStore.dispatch(a)} />
      {:else}
        <p class="empty">You don't work here. Get hired at the Employment Office.</p>
      {/if}

    {:else if svc.kind === "hiring"}
      <HiringScreen jobIds={svc.jobIds} />

    {:else if svc.kind === "education"}
      <EducationScreen courseIds={svc.courseIds} />

    {:else if svc.kind === "shop"}
      {#each svc.itemIds as id (id)}
        {@const it = ITEMS[id]}
        {@const a = { type: "buy", item: id } as const}
        {@const d = dis(a)}
        <ActionRow name={it.name}
          sub={it.clothing ? "clothing" : ""}
          badges={[...(it.happinessGain > 0 ? [{ text: `😀 +${it.happinessGain}` }] : []), { text: `⏳ ${it.timeCost}` }, { text: `$${it.cost}`, kind: "cost" }]}
          disabled={d.disabled} reason={d.reason} onact={() => gameStore.dispatch(a)} />
      {/each}

    {:else if svc.kind === "housing"}
      {@const pr = gameStore.preview({ type: "payRent" })}
      <div class="rentbar">
        <span>Rent due: <b>${player.rentDue}</b></span>
        <button class="pay" disabled={!pr.ok} title={pr.ok ? "" : (pr.reason ?? "")}
          onclick={() => gameStore.payRent()}>Pay Rent</button>
      </div>
      {#each svc.housingIds as id (id)}
        {@const h = HOUSING[id]}
        {@const a = { type: "rent", unit: id } as const}
        {@const d = dis(a)}
        <ActionRow name={h.name}
          sub={player.housingId === id ? "current home" : "move in"}
          badges={[{ text: `🏠 $${h.monthlyRent}/mo`, kind: "cost" }]}
          disabled={d.disabled} reason={d.reason} onact={() => gameStore.dispatch(a)} />
      {/each}

    {:else if svc.kind === "bank"}
      <BankPanel />
    {/if}
  {/each}
</div>

<style>
  .screen { font-family: ui-sans-serif, system-ui, sans-serif; padding: 8px; }
  .hd { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
  .hd .t { font-weight: 700; font-size: clamp(12px, 1.4vw, 15px); color: #2a2f1a; }
  .back { background: none; border: none; font-size: clamp(10px, 1.1vw, 12px); color: #4a90d9; cursor: pointer; }
  .empty { font-size: clamp(10px, 1.1vw, 12px); color: #8a8666; margin: 4px 0; }
  .rentbar { display: flex; align-items: center; justify-content: space-between; background: #fff; border-radius: 6px; padding: 6px 8px; margin-bottom: 6px; font-size: clamp(10px, 1.1vw, 12px); color: #2a2f1a; }
  .rentbar b { color: #b8860b; }
  .pay { background: #4a90d9; color: #fff; border: none; border-radius: 6px; padding: 5px 10px; font-size: clamp(10px, 1.1vw, 12px); font-weight: 700; cursor: pointer; }
  .pay:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
