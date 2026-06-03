<script lang="ts">
  import { onMount } from "svelte";
  import Board from "./Board.svelte";
  import DialogPanel from "./DialogPanel.svelte";
  import Feedback from "./Feedback.svelte";
  import { audio } from "./lib/sound";

  // The main theme is the first thing heard; if the browser blocks autoplay
  // here, AudioManager retries on the player's first interaction.
  onMount(() => audio.play("theme"));
</script>

<main>
  <div class="stage">
    <Board />
    <div class="panel"><DialogPanel /></div>
    <Feedback />
  </div>
</main>

<style>
  main { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 12px; }
  /* The stage matches the board's aspect ratio so overlays align to the artwork. */
  .stage { position: relative; width: 100%; max-width: 1100px; aspect-ratio: 2300 / 1850; }
  /* Overlay the HUD on the cream center panel region (Dialog bounds in the SVG). */
  .panel {
    position: absolute;
    left: 22%; top: 30%; width: 56%; height: 40%;
    overflow: auto;
  }
</style>
