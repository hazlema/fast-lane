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
    // Hand the Road path to the store so the token can tween along it.
    const road = container.querySelector<SVGPathElement>("#Road");
    if (road) gameStore.attachRoad(road);
    else console.warn("No #Road path found in board.svg");

    // Tag the sky cloud texture so CSS can drift it. It's a <use href="#_Image3">
    // with no transform of its own, so animating it pans only the clouds —
    // buildings and ground are separate elements and stay put.
    let clouds = 0;
    for (const u of container.querySelectorAll<SVGUseElement>("use")) {
      const href = u.getAttribute("href") ?? u.getAttribute("xlink:href");
      if (href === "#_Image3") { u.classList.add("sky-clouds"); clouds++; }
    }
    if (clouds === 0) console.warn("No cloud layer (#_Image3) found in board.svg");
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
  .board {
    position: absolute;
    inset: 0;
    border: 2px solid #2a2a2a;
    border-radius: 18px;
    overflow: hidden; /* clip the artwork to the rounded corners */
    box-shadow: 0 16px 40px #000a;
  }
  .board :global(svg) { width: 100%; height: 100%; display: block; }
  /* Hide the faint waypoint diamonds in-game (they're a dev aid). */
  .board :global(#Waypoints) { display: none; }

  /* Slowly pan the cloud texture so the sky feels alive. It's overscaled, so
     the gentle drift never exposes the texture's edges. */
  .board :global(.sky-clouds) {
    transform-box: fill-box;
    transform-origin: center;
    animation: cloud-drift 75s ease-in-out infinite alternate;
    will-change: transform;
  }
  /* -global- so the name isn't scoped away from the :global() rule above. */
  @keyframes -global-cloud-drift {
    from { transform: scale(1.06) translateX(-1.5%); }
    to   { transform: scale(1.06) translateX(1.5%); }
  }
  @media (prefers-reduced-motion: reduce) {
    .board :global(.sky-clouds) { animation: none; }
  }

  .token {
    position: absolute;
    width: 3%;
    aspect-ratio: 1;
    border-radius: 50%;
    background: radial-gradient(circle at 35% 30%, #ff7a7a, #d61f1f 70%);
    border: 3px solid #fff;
    box-shadow: 0 3px 7px #0008;
    transform: translate(-50%, -50%);
    z-index: 5;
    pointer-events: none;
  }
  .token.walking { filter: brightness(1.15); }
</style>
