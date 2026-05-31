<script lang="ts">
  import boardSvg from "../../assets/board.svg?raw";
  import { onMount } from "svelte";
  import { gameStore } from "./stores/game.svelte";
  import { WORLD } from "../data/world";
  import { BOARD_SIZE } from "../data/board";

  let container: HTMLDivElement;

  onMount(() => {
    // Bind a click on each building group (event bubbles up from the artwork).
    for (const b of WORLD.buildings) {
      const el = container.querySelector<SVGElement>("#" + CSS.escape(b.hitBoxId));
      if (!el) { console.warn("No SVG group for building", b.id, b.hitBoxId); continue; }
      el.style.cursor = "pointer";
      el.addEventListener("click", () => { void gameStore.goTo(b.node); });
    }
  });

  const xpct = (x: number) => (x / BOARD_SIZE.width) * 100;
  const ypct = (y: number) => (y / BOARD_SIZE.height) * 100;
</script>

<div class="board" bind:this={container}>
  {@html boardSvg}
  <div
    class="token"
    class:walking={gameStore.walking}
    style="left:{xpct(gameStore.tokenXY.x)}%; top:{ypct(gameStore.tokenXY.y)}%"
    title="You"
  ></div>
</div>

<style>
  .board { position: absolute; inset: 0; }
  .board :global(svg) { width: 100%; height: 100%; display: block; }
  /* Hide the faint waypoint diamonds in-game (they're a dev aid). */
  .board :global(#Waypoints) { display: none; }

  .token {
    position: absolute;
    width: 3%;
    aspect-ratio: 1;
    border-radius: 50%;
    background: radial-gradient(circle at 35% 30%, #ff7a7a, #d61f1f 70%);
    border: 3px solid #fff;
    box-shadow: 0 3px 7px #0008;
    transform: translate(-50%, -50%);
    transition: left 0.26s linear, top 0.26s linear;
    z-index: 5;
    pointer-events: none;
  }
  .token.walking { filter: brightness(1.15); }
</style>
