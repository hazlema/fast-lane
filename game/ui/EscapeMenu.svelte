<!-- game/ui/EscapeMenu.svelte -->
<script lang="ts">
  import { menuStore } from "./stores/menu.svelte";
  import { audio, fx } from "./lib/sound";

  // Mirror the audio state locally. App gates this component with {#if}, so it
  // mounts fresh each time the menu opens — these initialize from the live
  // values on open.
  let vol = $state(audio.getVolume());
  let muted = $state(audio.isMuted());
  let fxVol = $state(fx.getVolume());
  let fxMuted = $state(fx.isMuted());

  function onVolume(e: Event): void {
    vol = +(e.currentTarget as HTMLInputElement).value;
    audio.setVolume(vol);
    if (muted) { audio.mute(false); muted = false; } // dragging unmutes
  }

  function toggleMute(): void {
    audio.toggleMute();
    muted = audio.isMuted();
  }

  function onFxVolume(e: Event): void {
    fxVol = +(e.currentTarget as HTMLInputElement).value;
    fx.setVolume(fxVol);
    if (fxMuted) { fx.mute(false); fxMuted = false; } // dragging unmutes
  }

  function toggleFxMute(): void {
    fx.toggleMute();
    fxMuted = fx.isMuted();
    if (!fxMuted) fx.play("accept"); // audible confirmation it's back on
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="backdrop" onclick={() => menuStore.close()}>
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="card" onclick={(e) => e.stopPropagation()}>
    <h2>Menu</h2>

    <!-- Music group -->
    <div class="group">
      <button class="toggle" onclick={toggleMute}>
        {muted ? "🔇 Music off" : "🎵 Music on"}
      </button>
      <label class="vol">
        <span>Volume</span>
        <input type="range" min="0" max="1" step="0.01" value={vol} oninput={onVolume} />
      </label>
    </div>

    <!-- Sound-effects group. Releasing the slider chirps at the new level. -->
    <div class="group">
      <button class="toggle" onclick={toggleFxMute}>
        {fxMuted ? "🔇 FX off" : "🔔 FX on"}
      </button>
      <label class="vol">
        <span>Volume</span>
        <input type="range" min="0" max="1" step="0.01" value={fxVol}
          oninput={onFxVolume} onchange={() => fx.play("accept")} />
      </label>
    </div>

    <!-- Future: New Game / Restart group goes here. -->

    <button class="resume" onclick={() => menuStore.close()}>Resume</button>
  </div>
</div>

<style>
  .backdrop {
    position: absolute; inset: 0; z-index: 50;
    background: rgba(0, 0, 0, 0.45);
    display: flex; align-items: center; justify-content: center;
  }
  .card {
    font-family: ui-sans-serif, system-ui, sans-serif; color: #2a2f1a;
    background: #f5f2e8; border-radius: 10px; padding: 16px;
    width: min(320px, 80%); box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
  }
  h2 { font-size: clamp(14px, 1.8vw, 20px); margin: 0 0 12px; text-align: center; }
  .group {
    background: #fff; border-radius: 8px; padding: 10px; margin-bottom: 10px;
    display: flex; flex-direction: column; gap: 10px;
  }
  .toggle {
    background: #fff; color: #4a90d9; border: 1px solid #cdd9e8; border-radius: 6px;
    padding: 8px; font-size: 13px; font-weight: 700; cursor: pointer;
  }
  .vol { display: flex; align-items: center; justify-content: space-between; gap: 10px; font-size: 12px; font-weight: 600; }
  .vol input { flex: 1; cursor: pointer; }
  .resume {
    width: 100%; background: #4a90d9; color: #fff; border: none; border-radius: 6px;
    padding: 10px; font-size: 13px; font-weight: 700; cursor: pointer;
  }
</style>
