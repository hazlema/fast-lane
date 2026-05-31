<!-- game/ui/screens/HiringScreen.svelte -->
<script lang="ts">
  import { gameStore } from "../stores/game.svelte";
  import { WORLD } from "../../data/world";
  import { JOBS } from "../../data/jobs";
  import { COURSES } from "../../data/courses";
  import { CONFIG } from "../../data/config";
  import ActionRow from "./ActionRow.svelte";

  const degreeReq = (degrees: string[]) =>
    degrees.length ? `needs: ${degrees.map((d) => COURSES[d]?.name ?? d).join(" + ")}` : "no degree required";

  let { jobIds }: { jobIds: string[] } = $props();

  // Group the offered jobs by the building that employs them.
  const employers = $derived.by(() => {
    const ids = [...new Set(jobIds.map((j) => JOBS[j].buildingId))];
    return ids.map((bid) => ({
      id: bid,
      name: WORLD.buildings.find((b) => b.id === bid)?.name ?? bid,
      jobs: jobIds.filter((j) => JOBS[j].buildingId === bid),
    }));
  });

  let selected = $state<string | null>(null);
  const current = $derived(employers.find((e) => e.id === selected) ?? null);
</script>

{#if !current}
  <p class="lead">Pick an employer:</p>
  {#each employers as e (e.id)}
    <button class="employer" onclick={() => (selected = e.id)}>
      <span class="nm">{e.name}</span>
      <span class="cnt">{e.jobs.length} opening{e.jobs.length === 1 ? "" : "s"} ▸</span>
    </button>
  {/each}
{:else}
  <div class="subhd">
    <span class="nm">{current.name}</span>
    <button class="back" onclick={() => (selected = null)}>◂ Employers</button>
  </div>
  {#each current.jobs as id (id)}
    {@const job = JOBS[id]}
    {@const r = gameStore.preview({ type: "applyForJob", job: id })}
    <ActionRow name={`Apply: ${job.title}`}
      sub={degreeReq(job.requiredDegrees)}
      badges={[{ text: `💵 $${job.wage}/shift` }, { text: `⏳ ${CONFIG.applyJobTimeCost}` }]}
      disabled={!r.ok} reason={r.reason ?? ""} onact={() => gameStore.dispatch({ type: "applyForJob", job: id })} />
  {/each}
{/if}

<style>
  .lead { font-size: clamp(10px, 1.1vw, 12px); color: #555; margin: 0 0 6px; }
  .employer { display: flex; align-items: center; justify-content: space-between; width: 100%; text-align: left;
    background: #fff; border: none; border-radius: 6px; padding: 7px 8px; margin-bottom: 5px; cursor: pointer; }
  .employer .nm { font-size: clamp(11px, 1.2vw, 13px); font-weight: 600; color: #2a2f1a; }
  .employer .cnt { font-size: clamp(9px, 1vw, 11px); color: #4a90d9; }
  .subhd { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
  .subhd .nm { font-size: clamp(11px, 1.2vw, 13px); font-weight: 700; color: #2a2f1a; }
  .back { background: none; border: none; font-size: clamp(10px, 1.1vw, 12px); color: #4a90d9; cursor: pointer; }
</style>
