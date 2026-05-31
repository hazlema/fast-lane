<!-- game/ui/screens/HomeScreen.svelte -->
<script lang="ts">
  import { gameStore } from "../stores/game.svelte";

  // Newest entries first, capped so the feed stays readable.
  const feed = $derived([...gameStore.state.log].reverse().slice(0, 6));
  const week = $derived(gameStore.state.week);

  let saved = $state(false);
  function save() {
    gameStore.save();
    saved = true;
    setTimeout(() => { saved = false; }, 1500);
  }
</script>

<div class="home">
  <div class="news">
    <div class="mast"><span>The Daily Jones</span><span>Wk {week}</span></div>
    {#if feed.length === 0}
      <p class="li muted">Click a building on the board to get started.</p>
    {:else}
      {#each feed as e, i (i)}<p class="li">{e.text}</p>{/each}
    {/if}
  </div>
  <div class="actions">
    <button class="end" onclick={() => gameStore.endWeek()}>End Week →</button>
    <button class="save" onclick={save}>{saved ? "Saved ✓" : "Save"}</button>
  </div>
  <p class="tip">Click a building on the board to act.</p>
</div>

<style>
  .home { font-family: ui-sans-serif, system-ui, sans-serif; padding: 8px; }
  .news { background: #fffdf5; border: 1px solid #e7e0c4; border-radius: 6px; padding: 7px; margin-bottom: 8px; }
  .mast { font-family: Georgia, serif; font-weight: 700; font-size: clamp(11px, 1.2vw, 14px); border-bottom: 1px solid #ddd; padding-bottom: 3px; margin-bottom: 4px; display: flex; justify-content: space-between; }
  .li { font-size: clamp(9px, 1vw, 11px); color: #444; margin: 2px 0; }
  .li::before { content: "• "; color: #999; }
  .li.muted { color: #999; }
  .actions { display: flex; gap: 6px; }
  .end { flex: 1; background: #4a90d9; color: #fff; border: none; border-radius: 6px; padding: 8px; font-size: clamp(11px, 1.2vw, 13px); font-weight: 700; cursor: pointer; }
  .save { background: #fff; color: #4a90d9; border: 1px solid #cdd9e8; border-radius: 6px; padding: 8px 12px; font-size: clamp(10px, 1.1vw, 12px); font-weight: 700; cursor: pointer; }
  .tip { font-size: clamp(8px, 0.9vw, 10px); color: #8a8666; text-align: center; margin: 5px 0 0; }
</style>
