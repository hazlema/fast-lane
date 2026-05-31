<!-- game/ui/screens/GoalsScreen.svelte -->
<script lang="ts">
  import { gameStore } from "../stores/game.svelte";
  import { CONFIG } from "../../data/config";
  import type { Stat } from "../../engine/state";

  type Row = { key: Stat; label: string; step: number; min: number };
  const rows: Row[] = [
    { key: "wealth",    label: "💰 Wealth",    step: 500, min: 500 },
    { key: "happiness", label: "😀 Happiness", step: 10,  min: 10 },
    { key: "education", label: "📘 Education",  step: 10,  min: 10 },
    { key: "career",    label: "📈 Career",     step: 1,   min: 1 },
  ];

  const presets: Record<string, Record<Stat, number>> = {
    Easy:   { wealth: 2000,  happiness: 50,  education: 50,  career: 3 },
    Normal: { ...CONFIG.defaultGoals },
    Hard:   { wealth: 10000, happiness: 150, education: 150, career: 7 },
  };

  let goals = $state<Record<Stat, number>>({ ...CONFIG.defaultGoals });

  function bump(r: Row, dir: 1 | -1) {
    goals[r.key] = Math.max(r.min, goals[r.key] + dir * r.step);
  }
  function applyPreset(name: string) { goals = { ...presets[name] }; }
</script>

<div class="goals">
  <h2>Set your targets to win</h2>
  <p class="hint">Reach all four to win. Higher = a longer game.</p>

  {#each rows as r (r.key)}
    <div class="row">
      <span class="nm">{r.label}</span>
      <span class="stepper">
        <button onclick={() => bump(r, -1)} aria-label="decrease">–</button>
        <span class="v">{r.key === "wealth" ? "$" : ""}{goals[r.key]}</span>
        <button onclick={() => bump(r, 1)} aria-label="increase">+</button>
      </span>
    </div>
  {/each}

  <div class="presets">
    {#each Object.keys(presets) as name (name)}
      <button class="ghost" onclick={() => applyPreset(name)}>{name}</button>
    {/each}
  </div>
  <button class="start" onclick={() => gameStore.startGame(goals)}>Start Game →</button>
</div>

<style>
  .goals { font-family: ui-sans-serif, system-ui, sans-serif; color: #2a2f1a; padding: 8px; }
  h2 { font-size: clamp(13px, 1.6vw, 18px); margin: 0 0 2px; }
  .hint { font-size: clamp(9px, 1vw, 12px); color: #777; margin: 0 0 8px; }
  .row { display: flex; align-items: center; justify-content: space-between; background: #fff; border-radius: 6px; padding: 5px 8px; margin-bottom: 5px; }
  .nm { font-size: clamp(11px, 1.2vw, 14px); font-weight: 600; }
  .stepper { display: flex; align-items: center; gap: 6px; }
  .stepper button { width: 22px; height: 22px; border-radius: 5px; border: 1px solid #cdd9e8; background: #fff; color: #4a90d9; font-weight: 700; cursor: pointer; }
  .v { font-size: clamp(11px, 1.2vw, 14px); font-weight: 700; min-width: 56px; text-align: center; }
  .presets { display: flex; gap: 6px; margin: 6px 0; }
  .ghost { flex: 1; background: #fff; color: #4a90d9; border: 1px solid #cdd9e8; border-radius: 6px; padding: 5px; font-size: 11px; font-weight: 700; cursor: pointer; }
  .start { width: 100%; background: #4a90d9; color: #fff; border: none; border-radius: 6px; padding: 8px; font-size: 13px; font-weight: 700; cursor: pointer; }
</style>
