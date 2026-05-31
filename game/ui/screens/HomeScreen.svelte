<!-- game/ui/screens/HomeScreen.svelte -->
<script lang="ts">
  import { gameStore } from "../stores/game.svelte";

  const week = $derived(gameStore.state.week);
  // Only THIS week's briefing — the paper is reprinted each week, not accreted.
  const feed = $derived(gameStore.state.log.filter((e) => e.week === week).reverse());
</script>

<div class="home">
  <div class="news">
    <div class="mast"><span>The Daily Jones</span><span>Wk {week}</span></div>
    {#if feed.length === 0}
      <p class="li muted">Click a building on the board to get started.</p>
    {:else}
      {#each feed as e, i (i)}<p class="li" class:lead={i === 0}>{e.text}</p>{/each}
    {/if}
  </div>
  <button class="end" onclick={() => gameStore.endWeek()}>End Week →</button>
  <p class="tip">Click a building on the board to act.</p>
</div>

<style>
  .home { font-family: ui-sans-serif, system-ui, sans-serif; padding: 8px; }
  .news { background: #fffdf5; border: 1px solid #e7e0c4; border-radius: 8px; padding: 10px 12px; margin-bottom: 10px; }
  .mast { font-family: Georgia, serif; font-weight: 700; font-size: clamp(15px, 1.8vw, 20px); border-bottom: 2px solid #cdc6a8; padding-bottom: 5px; margin-bottom: 7px; display: flex; justify-content: space-between; }
  .li { font-size: clamp(13px, 1.5vw, 16px); line-height: 1.4; color: #333; margin: 4px 0; }
  .li::before { content: "• "; color: #b09a55; }
  .li.lead { font-weight: 600; color: #1a2412; } /* newest item stands out */
  .li.muted { color: #999; font-weight: 400; }
  .end { width: 100%; background: #4a90d9; color: #fff; border: none; border-radius: 6px; padding: 8px; font-size: clamp(11px, 1.2vw, 13px); font-weight: 700; cursor: pointer; }
  .tip { font-size: clamp(8px, 0.9vw, 10px); color: #8a8666; text-align: center; margin: 5px 0 0; }
</style>
