<!-- game/ui/DialogPanel.svelte -->
<script lang="ts">
  import { gameStore } from "./stores/game.svelte";
  import Hud from "./Hud.svelte";
  import GoalsScreen from "./screens/GoalsScreen.svelte";
  import HomeScreen from "./screens/HomeScreen.svelte";
  import WinScreen from "./screens/WinScreen.svelte";
  import BuildingScreen from "./screens/BuildingScreen.svelte";

  const screen = $derived(gameStore.screen);
</script>

<div class="panel-body">
  {#if screen === "goals"}
    <GoalsScreen />
  {:else}
    <Hud />
    {#if screen === "home"}
      <HomeScreen />
    {:else if screen === "won"}
      <WinScreen />
    {:else}
      <BuildingScreen buildingId={screen} />
    {/if}
  {/if}
</div>

<style>
  .panel-body { width: 100%; height: 100%; }
</style>
