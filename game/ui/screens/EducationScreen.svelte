<!-- game/ui/screens/EducationScreen.svelte -->
<script lang="ts">
  import { gameStore } from "../stores/game.svelte";
  import { COURSES } from "../../data/courses";
  import { CONFIG } from "../../data/config";
  import ActionRow from "./ActionRow.svelte";

  let { courseIds }: { courseIds: string[] } = $props();
  const player = $derived(gameStore.player);
  const enrolled = $derived(player.enrolledCourse ? COURSES[player.enrolledCourse] : null);
  const studyPreview = $derived(gameStore.preview({ type: "study" }));

  // The degree tree: only show degrees not yet earned whose prerequisites are met.
  const available = $derived(
    courseIds.filter((id) => {
      const c = COURSES[id];
      return c && !player.completedCourses.includes(id) && c.requires.every((r) => player.completedCourses.includes(r));
    }),
  );
  const earnedNames = $derived(player.completedCourses.map((id) => COURSES[id]?.name ?? id).join(", "));
</script>

{#if enrolled}
  <div class="enrolled">
    <div class="cur">Enrolled: <b>{enrolled.name}</b></div>
    <div class="prog">Progress: {player.courseProgress}/{CONFIG.studySessionsToGraduate} sessions</div>
    <button class="study" disabled={!studyPreview.ok}
      title={studyPreview.ok ? "" : (studyPreview.reason ?? "")}
      onclick={() => gameStore.dispatch({ type: "study" })}>
      Study ({enrolled.timeCost} time)
    </button>
  </div>
{:else}
  <p class="lead">Enroll in a degree (one at a time):</p>
  {#if available.length === 0}
    <p class="lead">No degrees available right now — you've earned all you can.</p>
  {/if}
  {#each available as id (id)}
    {@const c = COURSES[id]}
    {@const r = gameStore.preview({ type: "enroll", course: id })}
    <ActionRow name={c.name}
      sub={`${CONFIG.studySessionsToGraduate} study sessions → +${c.educationGain} Edu`}
      badges={[{ text: `⏳ ${c.timeCost}/study` }, { text: `$${c.cost} tuition`, kind: "cost" }]}
      disabled={!r.ok} reason={r.reason ?? ""} onact={() => gameStore.dispatch({ type: "enroll", course: id })} />
  {/each}
  {#if player.completedCourses.length}
    <p class="earned">🎓 Earned: {earnedNames}</p>
  {/if}
{/if}

<style>
  .lead { font-size: clamp(10px, 1.1vw, 12px); color: #555; margin: 0 0 6px; }
  .enrolled { background: #fff; border-radius: 6px; padding: 8px; color: #2a2f1a; }
  .cur { font-size: clamp(11px, 1.2vw, 14px); }
  .prog { font-size: clamp(10px, 1.1vw, 12px); color: #777; margin: 4px 0 8px; }
  .study { width: 100%; background: #4a90d9; color: #fff; border: none; border-radius: 6px; padding: 8px; font-size: clamp(11px, 1.2vw, 13px); font-weight: 700; cursor: pointer; }
  .study:disabled { opacity: 0.5; cursor: not-allowed; }
  .earned { font-size: clamp(9px, 1vw, 11px); color: #5a7d3a; margin: 8px 0 0; }
</style>
