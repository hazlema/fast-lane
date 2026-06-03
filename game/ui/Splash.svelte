<!-- game/ui/Splash.svelte -->
<!-- Week-end interstitial art (doctor visit, rent is due). Drains the store's
     splash queue one sprite at a time: each pops over the whole stage for a
     few seconds; click to skip ahead. -->
<script lang="ts">
  import { gameStore } from "./stores/game.svelte";
  import doctorUrl from "../../assets/sprites/doctor_visit.png?url";
  import rentUrl from "../../assets/sprites/rent_is_due.png?url";

  const ART: Record<string, { src: string; alt: string }> = {
    doctor: { src: doctorUrl, alt: "Doctor visit" },
    rent: { src: rentUrl, alt: "Rent is due" },
  };
  const SHOW_MS = 2600;

  let current = $state<string | null>(null);
  let timer: ReturnType<typeof setTimeout> | undefined;

  // Idle and something queued? Show the next sprite for SHOW_MS.
  $effect(() => {
    if (current !== null || gameStore.splashes.length === 0) return;
    current = gameStore.shiftSplash() ?? null;
    timer = setTimeout(() => { current = null; }, SHOW_MS);
  });

  function skip(): void {
    clearTimeout(timer);
    current = null; // the effect pulls the next queued splash, if any
  }
</script>

{#if current && ART[current]}
  <div class="splash" onclick={skip} role="presentation">
    <img src={ART[current].src} alt={ART[current].alt} />
  </div>
{/if}

<style>
  .splash {
    position: absolute; inset: 0; z-index: 30;
    display: flex; align-items: center; justify-content: center;
    background: rgba(0, 0, 0, 0.35);
    cursor: pointer;
  }
  .splash img {
    width: 38%; max-width: 420px; height: auto;
    filter: drop-shadow(0 10px 28px rgba(0, 0, 0, 0.45));
    animation: splash-pop 0.25s ease-out;
  }
  @keyframes splash-pop {
    from { transform: scale(0.7); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
  }
</style>
