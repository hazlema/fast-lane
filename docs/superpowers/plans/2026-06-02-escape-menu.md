# Escape Menu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An Escape-key settings overlay with the background-music controls (mute toggle + volume slider) and a Resume button, structured so New Game / Restart can be added later.

**Architecture:** Two new `AudioManager` getters expose current volume/mute so the UI can read state it can only currently set. A tiny rune store (`menu.svelte.ts`) holds the overlay's open flag. An `EscapeMenu.svelte` overlay reads/drives the `audio` singleton. `App.svelte` renders the overlay when open and toggles it from a window `keydown` (Escape) listener. The game is turn-based, so the overlay is a settings layer, not a true pause.

**Tech Stack:** TypeScript, Bun test runner, Svelte 5 (runes, `onclick={}` syntax), the existing `audio` singleton (`game/ui/lib/sound.ts`).

---

## File Structure

- **Modify** `game/ui/lib/audio.ts` — add `getVolume(): number` and `isMuted(): boolean`. Pure, unit-tested.
- **Modify** `game/ui/lib/audio.test.ts` — tests for the two getters.
- **Create** `game/ui/stores/menu.svelte.ts` — rune store: `open` flag, `toggle()`, `close()`. One responsibility: is the overlay showing.
- **Create** `game/ui/EscapeMenu.svelte` — the overlay (backdrop + card with mute toggle, volume slider, Resume). Reads/drives `audio`.
- **Modify** `game/ui/App.svelte` — render `<EscapeMenu />` when `menuStore.open`; window `keydown` listener toggles the menu on Escape.

---

## Task 1: AudioManager getters — getVolume / isMuted

**Files:**
- Modify: `game/ui/lib/audio.ts`
- Test: `game/ui/lib/audio.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `game/ui/lib/audio.test.ts` (reuse the existing `makeManager` helper already defined in that file):

```ts
test("getVolume reflects setVolume", () => {
  const { mgr } = makeManager();
  expect(mgr.getVolume()).toBe(1); // default
  mgr.setVolume(0.4);
  expect(mgr.getVolume()).toBe(0.4);
});

test("isMuted reflects mute and toggleMute", () => {
  const { mgr } = makeManager();
  expect(mgr.isMuted()).toBe(false); // default
  mgr.mute(true);
  expect(mgr.isMuted()).toBe(true);
  mgr.toggleMute();
  expect(mgr.isMuted()).toBe(false);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun test game/ui/lib/audio.test.ts`
Expected: FAIL — `mgr.getVolume is not a function`.

- [ ] **Step 3: Write the minimal implementation**

In `game/ui/lib/audio.ts`, add these two methods to the `AudioManager` class (e.g. right after `toggleMute`):

```ts
  /** Current master volume, 0..1. */
  getVolume(): number {
    return this.vol;
  }

  /** Whether audio is currently muted. */
  isMuted(): boolean {
    return this.muted;
  }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun test game/ui/lib/audio.test.ts`
Expected: PASS — 11 tests total.

- [ ] **Step 5: Commit**

```bash
git add game/ui/lib/audio.ts game/ui/lib/audio.test.ts
git commit -m "feat(sound): expose getVolume/isMuted for UI controls

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Menu store, overlay component, and App wiring

**Files:**
- Create: `game/ui/stores/menu.svelte.ts`
- Create: `game/ui/EscapeMenu.svelte`
- Modify: `game/ui/App.svelte`

No bun unit test: rune stores and Svelte components need the Svelte compiler (same as the existing `game.svelte.ts`, which is not unit-tested). This task is verified by `bun run ui:check` here and by Playwright in Task 3.

- [ ] **Step 1: Create the menu store**

Create `game/ui/stores/menu.svelte.ts`:

```ts
// game/ui/stores/menu.svelte.ts
// Tiny UI store: whether the Escape settings overlay is showing. Kept separate
// from the game-logic store so a future trigger (gear button, New Game) has one
// obvious place to call.
let open = $state(false);

export const menuStore = {
  get open(): boolean { return open; },
  toggle(): void { open = !open; },
  close(): void { open = false; },
};
```

- [ ] **Step 2: Create the overlay component**

Create `game/ui/EscapeMenu.svelte`:

```svelte
<!-- game/ui/EscapeMenu.svelte -->
<script lang="ts">
  import { menuStore } from "./stores/menu.svelte";
  import { audio } from "./lib/sound";

  // Mirror the audio state locally. App gates this component with {#if}, so it
  // mounts fresh each time the menu opens — these initialize from the live
  // values on open.
  let vol = $state(audio.getVolume());
  let muted = $state(audio.isMuted());

  function onVolume(e: Event): void {
    vol = +(e.currentTarget as HTMLInputElement).value;
    audio.setVolume(vol);
    if (muted) { audio.mute(false); muted = false; } // dragging unmutes
  }

  function toggleMute(): void {
    audio.toggleMute();
    muted = audio.isMuted();
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div class="backdrop" onclick={() => menuStore.close()}>
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="card" onclick={(e) => e.stopPropagation()}>
    <h2>Menu</h2>

    <!-- Audio group -->
    <div class="group">
      <button class="toggle" onclick={toggleMute}>
        {muted ? "🔇 Sound off" : "🔊 Sound on"}
      </button>
      <label class="vol">
        <span>Volume</span>
        <input type="range" min="0" max="1" step="0.01" value={vol} oninput={onVolume} />
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
```

- [ ] **Step 3: Wire it into App.svelte**

Replace the entire `<script>` block and the `<main>` markup in `game/ui/App.svelte`. Current `<script>`:

```svelte
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
```

becomes:

```svelte
<script lang="ts">
  import { onMount } from "svelte";
  import Board from "./Board.svelte";
  import DialogPanel from "./DialogPanel.svelte";
  import Feedback from "./Feedback.svelte";
  import EscapeMenu from "./EscapeMenu.svelte";
  import { audio } from "./lib/sound";
  import { menuStore } from "./stores/menu.svelte";

  onMount(() => {
    // The main theme is the first thing heard; if the browser blocks autoplay
    // here, AudioManager retries on the player's first interaction.
    audio.play("theme");
    // Escape toggles the settings overlay from anywhere.
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") menuStore.toggle(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
</script>
```

And the current `<main>` block:

```svelte
<main>
  <div class="stage">
    <Board />
    <div class="panel"><DialogPanel /></div>
    <Feedback />
  </div>
</main>
```

becomes (add the gated overlay as the last child of `.stage`):

```svelte
<main>
  <div class="stage">
    <Board />
    <div class="panel"><DialogPanel /></div>
    <Feedback />
    {#if menuStore.open}<EscapeMenu />{/if}
  </div>
</main>
```

Leave the `<style>` block of `App.svelte` unchanged.

- [ ] **Step 4: Type-check and run the full suite**

Run: `bun run ui:check && bun test`
Expected: `ui:check` → 0 errors, 0 warnings (the `svelte-ignore` comments suppress the backdrop/card a11y warnings). `bun test` → all pass, including the 2 new getter tests (11 audio tests total).

If `ui:check` reports a11y warnings on the `.backdrop`/`.card` divs, confirm the `<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->` comment sits on the line immediately above each div. If it reports a different warning code, update the ignore comment to the exact code it printed.

- [ ] **Step 5: Commit**

```bash
git add game/ui/stores/menu.svelte.ts game/ui/EscapeMenu.svelte game/ui/App.svelte
git commit -m "feat(menu): Escape settings overlay with audio controls

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Verify in the real game (Playwright)

**Files:** none (manual behavioral verification).

- [ ] **Step 1: Start the dev server**

Run: `bun run ui:dev` (note the port it prints — 5173, or the next free port).

- [ ] **Step 2: Drive the overlay with the Playwright MCP tools**

1. Navigate to the dev URL. Click once anywhere to satisfy autoplay unlock.
2. Press Escape (`browser_press_key` with `Escape`). Confirm the overlay appears — evaluate `!!document.querySelector('.backdrop')` → `true`.
3. Press Escape again. Confirm it closes — `document.querySelector('.backdrop')` → `null`.
4. Press Escape to reopen. Click the "🔊 Sound on" / "🔇 Sound off" toggle; confirm the label flips and `localStorage.getItem('assetgen.audio')` shows `"muted":true`.
5. Set the volume slider and confirm it drives audio — evaluate to set the range input's value and dispatch an `input` event, then read `JSON.parse(localStorage.getItem('assetgen.audio')).vol` and confirm it matches; confirm `muted` is now `false` (dragging unmuted).
6. Click inside the `.card` (e.g. the `<h2>`); confirm the overlay stays open. Click the `.backdrop` (outside the card); confirm it closes.
7. Reopen and click Resume; confirm it closes.

- [ ] **Step 3: Record the result**

Confirm in the conversation: Escape opens/closes; mute toggles and persists; volume drives audio and unmutes; backdrop and Resume close; inner clicks don't. If any step fails, debug before considering the feature complete.

---

## Notes for the implementer

- Do NOT add New Game / Restart actions — only leave the marked comment where they will go.
- The overlay lives inside `.stage` (which is `position: relative`), so the `position: absolute; inset: 0` backdrop covers the board area; that is intended.
- The component mounts fresh on each open (App's `{#if}`), so its local `vol`/`muted` state initializes from the live `audio` getters every time — no external reactivity needed.
- Keep `App.svelte`'s existing `<style>` block untouched.
