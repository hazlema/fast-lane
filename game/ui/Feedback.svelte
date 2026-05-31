<!-- game/ui/Feedback.svelte -->
<!-- Transient feedback over the whole stage: confetti for good news,
     an auto-closing dialog (with the reason) for bad news. -->
<script lang="ts">
  import { gameStore } from "./stores/game.svelte";

  type Piece = { left: number; delay: number; dur: number; color: string; rot: number };
  const COLORS = ["#4a90d9", "#e6b800", "#e0533d", "#3fae5a", "#9b59b6", "#ff7aa2"];

  let confetti = $state<Piece[]>([]);
  let dialog = $state<string | null>(null);
  let seen = 0;

  function makeConfetti(): Piece[] {
    return Array.from({ length: 60 }, () => ({
      left: Math.random() * 100,
      delay: Math.random() * 0.4,
      dur: 1.1 + Math.random() * 1.1,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      rot: Math.random() * 360,
    }));
  }

  // React to a new notice (id change) and show the matching effect.
  $effect(() => {
    const n = gameStore.notice;
    if (!n || n.id === seen) return;
    seen = n.id;
    if (n.tone === "good") {
      confetti = makeConfetti();
      setTimeout(() => { confetti = []; }, 2400);
    } else {
      dialog = n.text;
      setTimeout(() => { dialog = null; }, 3500);
    }
  });
</script>

{#if confetti.length}
  <div class="confetti" aria-hidden="true">
    {#each confetti as p, i (i)}
      <span class="piece" style="left:{p.left}%; background:{p.color}; animation-delay:{p.delay}s; animation-duration:{p.dur}s; --rot:{p.rot}deg"></span>
    {/each}
  </div>
{/if}

{#if dialog}
  <div class="dialog-wrap" onclick={() => (dialog = null)} role="presentation">
    <div class="dialog">
      <div class="title">No offer</div>
      <div class="msg">{dialog}</div>
      <div class="hint">(tap to dismiss)</div>
    </div>
  </div>
{/if}

<style>
  .confetti, .dialog-wrap {
    position: absolute; inset: 0; overflow: hidden; z-index: 20; pointer-events: none;
  }
  .piece {
    position: absolute; top: -8%; width: 9px; height: 14px; border-radius: 2px;
    transform: rotate(var(--rot));
    animation-name: fall; animation-timing-function: ease-in; animation-fill-mode: forwards;
  }
  @keyframes fall {
    0% { transform: translateY(0) rotate(var(--rot)); opacity: 1; }
    100% { transform: translateY(115vh) rotate(calc(var(--rot) + 540deg)); opacity: 0.9; }
  }
  .dialog-wrap { display: flex; align-items: center; justify-content: center; pointer-events: auto; }
  .dialog {
    background: #fff; border: 2px solid #cfc9ad; border-radius: 10px; padding: 14px 18px;
    max-width: 70%; text-align: center; box-shadow: 0 6px 22px rgba(0,0,0,.3);
    font-family: ui-sans-serif, system-ui, sans-serif; color: #2a2f1a;
    animation: pop 0.18s ease-out;
  }
  .dialog .title { font-weight: 800; font-size: clamp(13px, 1.6vw, 17px); color: #9a3b3b; margin-bottom: 4px; }
  .dialog .msg { font-size: clamp(11px, 1.3vw, 14px); }
  .dialog .hint { font-size: clamp(8px, 0.9vw, 10px); color: #999; margin-top: 6px; }
  @keyframes pop { from { transform: scale(0.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }
</style>
