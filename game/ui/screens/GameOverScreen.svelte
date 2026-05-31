<!-- game/ui/screens/GameOverScreen.svelte -->
<script lang="ts">
  import { gameStore } from "../stores/game.svelte";

  const week = $derived(gameStore.state.week);
</script>

<div class="over">
  <div class="icon">📦</div>
  <h3>Evicted!</h3>
  <p class="sub">You fell too far behind on rent and lost your place in week {week}.</p>
  <button class="ng" onclick={() => gameStore.newGame()}>New Game</button>
</div>

<style>
  .over { font-family: ui-sans-serif, system-ui, sans-serif; color: #2a2f1a; text-align: center; padding: 10px; }
  .icon { font-size: clamp(28px, 4vw, 40px); }
  h3 { margin: 4px 0; font-size: clamp(13px, 1.6vw, 18px); color: #a01; }
  .sub { font-size: clamp(10px, 1.1vw, 13px); color: #555; }
  .ng { margin-top: 8px; background: #4a90d9; color: #fff; border: none; border-radius: 6px; padding: 8px 16px; font-size: clamp(11px, 1.2vw, 13px); font-weight: 700; cursor: pointer; }
</style>
