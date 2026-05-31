<!-- game/ui/screens/ActionRow.svelte -->
<script lang="ts">
  type Badge = { text: string; kind?: "cost" };
  let { name, sub = "", badges = [], disabled = false, reason = "", onact }:
    { name: string; sub?: string; badges?: Badge[]; disabled?: boolean; reason?: string; onact: () => void } = $props();
</script>

<button class="row" class:disabled onclick={() => { if (!disabled) onact(); }} title={disabled ? reason : ""}>
  <span class="info">
    <span class="nm">{name}</span>
    {#if sub}<span class="sub">{sub}</span>{/if}
  </span>
  <span class="badges">
    {#each badges as b (b.text)}<span class="bdg" class:cost={b.kind === "cost"}>{b.text}</span>{/each}
  </span>
</button>

<style>
  .row { display: flex; align-items: center; justify-content: space-between; width: 100%; text-align: left;
    background: #fff; border: none; border-radius: 6px; padding: 6px 8px; margin-bottom: 5px; cursor: pointer; }
  .row.disabled { opacity: 0.5; cursor: not-allowed; }
  .info { display: flex; flex-direction: column; }
  .nm { font-size: clamp(11px, 1.2vw, 13px); font-weight: 600; color: #2a2f1a; }
  .sub { font-size: clamp(8px, 0.9vw, 10px); color: #777; }
  .badges { display: flex; gap: 4px; align-items: center; }
  .bdg { font-size: clamp(8px, 0.9vw, 10px); background: #eef3fa; color: #2c5d8f; border-radius: 4px; padding: 2px 5px; white-space: nowrap; }
  .bdg.cost { background: #fbeaea; color: #9a3b3b; }
</style>
