# Sound System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A singleton background-music manager that any part of the game can call to swap looping tracks by context (main theme, per-building, traveling).

**Architecture:** A pure, DOM-injectable `AudioManager` class in `game/ui/lib/audio.ts` owns all playback mechanics (load, loop, swap, autoplay-unlock, volume/mute, persistence) and is unit-tested under `bun test` with a fake audio element. A thin Vite glue file `game/ui/lib/sound.ts` imports the mp3 URLs (`?url`) and constructs the exported `audio` singleton — this split exists because `?url` imports only resolve under Vite, not `bun test`, mirroring the pure-core/glue pattern of `roadWalk.ts`. The `gameStore` calls the singleton at three hook points.

**Tech Stack:** TypeScript, Bun test runner, Vite asset imports, `HTMLAudioElement`, Svelte 5 (consumer side only).

---

## File Structure

- **Create** `game/ui/lib/audio.ts` — `AudioManager` class + `SoundEl`/`ElFactory`/`Storage` types. Pure TS, no mp3 imports, no Svelte. The unit-tested core.
- **Create** `game/ui/lib/audio.test.ts` — bun tests using a fake element + fake storage.
- **Create** `game/ui/lib/sound.ts` — Vite glue: imports the three mp3s as URLs, builds the manifest, exports `const audio = new AudioManager(manifest)`.
- **Modify** `game/ui/stores/game.svelte.ts` — call `audio.playTravel()` in `goTo`, `audio.play(node)` in `openBuilding`.
- **Modify** `game/ui/App.svelte` — start the main theme on mount.

### Manifest keys (node id === building id, so `audio.play(node)` maps directly)

Current tracks in `assets/sound/`: `theme` → `main_theme.mp3`, `travel` → `traveling.mp3`, `employment` → `employment_office.mp3`. Every other building id (`highsec`, `rentoffice`, `lowcost`, `pawn`, `discount`, `frosty`, `offrack`, `electronics`, `university`, `factory`, `bank`, `tryandsave`, `dealership`) is absent from the manifest and **falls back to `theme`** until authored.

---

## Task 1: AudioManager core — play / swap / theme-fallback

**Files:**
- Create: `game/ui/lib/audio.ts`
- Test: `game/ui/lib/audio.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `game/ui/lib/audio.test.ts`:

```ts
import { test, expect } from "bun:test";
import { AudioManager, type SoundEl, type Storage } from "./audio";

// Records every interaction so tests can assert on playback behavior.
class FakeEl implements SoundEl {
  loop = false;
  volume = 1;
  currentTime = 0;
  playCount = 0;
  pauseCount = 0;
  // Toggle to simulate the browser blocking autoplay.
  rejectPlay = false;
  async play(): Promise<void> {
    this.playCount++;
    if (this.rejectPlay) throw new Error("NotAllowedError");
  }
  pause(): void { this.pauseCount++; }
}

class FakeStorage implements Storage {
  map = new Map<string, string>();
  getItem(k: string) { return this.map.get(k) ?? null; }
  setItem(k: string, v: string) { this.map.set(k, v); }
}

// Build a manager whose elements are FakeEls we can inspect by key.
function makeManager(extra: Record<string, string> = {}) {
  const els = new Map<string, FakeEl>();
  const manifest = { theme: "theme.mp3", travel: "travel.mp3", bank: "bank.mp3", ...extra };
  const mgr = new AudioManager(manifest, {
    fadeMs: 0,
    storage: new FakeStorage(),
    factory: (src: string) => {
      const el = new FakeEl();
      els.set(src, el);
      return el;
    },
  });
  // Look an element up by manifest key.
  const el = (key: string) => els.get(manifest[key as keyof typeof manifest]);
  return { mgr, el, manifest };
}

test("play() starts the track and loops it", () => {
  const { mgr, el } = makeManager();
  mgr.play("bank");
  expect(el("bank")!.playCount).toBe(1);
  expect(el("bank")!.loop).toBe(true);
});

test("playing the same key twice does not restart", () => {
  const { mgr, el } = makeManager();
  mgr.play("bank");
  mgr.play("bank");
  expect(el("bank")!.playCount).toBe(1);
});

test("switching tracks stops the previous and starts the new one", () => {
  const { mgr, el } = makeManager();
  mgr.play("bank");
  mgr.play("theme");
  expect(el("bank")!.pauseCount).toBe(1);
  expect(el("theme")!.playCount).toBe(1);
});

test("an unmapped building falls back to the theme track", () => {
  const { mgr, el } = makeManager();
  mgr.play("frosty"); // not in manifest
  expect(el("theme")!.playCount).toBe(1);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun test game/ui/lib/audio.test.ts`
Expected: FAIL — `Cannot find module './audio'` (file does not exist yet).

- [ ] **Step 3: Write the minimal implementation**

Create `game/ui/lib/audio.ts`:

```ts
// game/ui/lib/audio.ts
// Background-music manager. One looping track plays at a time, chosen by game
// context. Pure TS + injectable element/storage so it is testable under bun
// (no real DOM). The Vite-coupled singleton lives in ./sound.ts.

// The slice of HTMLAudioElement we depend on — lets tests inject a fake.
export interface SoundEl {
  loop: boolean;
  volume: number;
  currentTime: number;
  play(): Promise<void>;
  pause(): void;
}

export type ElFactory = (src: string) => SoundEl;

// The slice of localStorage we depend on.
export interface Storage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface AudioOpts {
  factory?: ElFactory;
  storage?: Storage;
  fadeMs?: number; // fade-out on stop, to avoid the pop on an abrupt pause
}

const PERSIST_KEY = "assetgen.audio";
const FALLBACK_KEY = "theme"; // unmapped buildings play the main theme

export class AudioManager {
  private manifest: Record<string, string>;
  private factory: ElFactory;
  private store: Storage | null;
  private fadeMs: number;

  private cache = new Map<string, SoundEl>();
  private currentKey: string | null = null;

  private vol = 1;
  private muted = false;

  constructor(manifest: Record<string, string>, opts: AudioOpts = {}) {
    this.manifest = manifest;
    this.factory = opts.factory ?? ((src) => new Audio(src) as unknown as SoundEl);
    this.store = opts.storage ?? (typeof localStorage !== "undefined" ? localStorage : null);
    this.fadeMs = opts.fadeMs ?? 60;
  }

  /** Play the looping track for `key` (theme | building id). No-op if already current. */
  play(key: string): void {
    const k = this.resolve(key);
    if (k === this.currentKey) return;
    this.fadeStop(this.currentEl());
    this.currentKey = k;
    this.start(k);
  }

  /** Convenience: the traveling loop. */
  playTravel(): void {
    this.play("travel");
  }

  /** Fade out and go silent. */
  stop(): void {
    this.fadeStop(this.currentEl());
    this.currentKey = null;
  }

  // A key with no track falls back to the theme.
  private resolve(key: string): string {
    return this.manifest[key] ? key : FALLBACK_KEY;
  }

  private currentEl(): SoundEl | undefined {
    return this.currentKey ? this.cache.get(this.currentKey) : undefined;
  }

  // Get-or-create the looping element for a key.
  private el(key: string): SoundEl {
    let el = this.cache.get(key);
    if (!el) {
      el = this.factory(this.manifest[key]);
      el.loop = true;
      this.cache.set(key, el);
    }
    return el;
  }

  private start(key: string): void {
    const el = this.el(key);
    el.loop = true;
    el.currentTime = 0;
    el.volume = this.muted ? 0 : this.vol;
    void el.play();
  }

  // Fade the volume to zero then pause, so a track swap doesn't click.
  private fadeStop(el?: SoundEl): void {
    if (!el) return;
    if (this.fadeMs <= 0) { el.pause(); return; }
    const start = el.volume;
    const steps = 4;
    let i = 0;
    const id = setInterval(() => {
      i++;
      el.volume = start * (1 - i / steps);
      if (i >= steps) { clearInterval(id); el.pause(); el.volume = start; }
    }, this.fadeMs / steps);
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun test game/ui/lib/audio.test.ts`
Expected: PASS — 4 tests.

- [ ] **Step 5: Commit**

```bash
git add game/ui/lib/audio.ts game/ui/lib/audio.test.ts
git commit -m "feat(sound): AudioManager core — looping play, swap, theme fallback

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Volume, mute, and persistence

**Files:**
- Modify: `game/ui/lib/audio.ts`
- Test: `game/ui/lib/audio.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `game/ui/lib/audio.test.ts`:

```ts
test("toggleMute silences the current track without pausing it", () => {
  const { mgr, el } = makeManager();
  mgr.play("bank");
  mgr.toggleMute();
  expect(el("bank")!.volume).toBe(0);
  expect(el("bank")!.pauseCount).toBe(0); // still playing, position kept
  mgr.toggleMute();
  expect(el("bank")!.volume).toBe(1); // restored to master volume
});

test("setVolume applies to the current track and persists with mute", () => {
  const els = new Map<string, FakeEl>();
  const storage = new FakeStorage();
  const manifest = { theme: "theme.mp3", travel: "travel.mp3", bank: "bank.mp3" };
  const mgr = new AudioManager(manifest, {
    fadeMs: 0, storage,
    factory: (src) => { const el = new FakeEl(); els.set(src, el); return el; },
  });
  mgr.play("bank");
  mgr.setVolume(0.5);
  expect(els.get("bank.mp3")!.volume).toBe(0.5);
  mgr.mute(true);
  const saved = JSON.parse(storage.getItem("assetgen.audio")!);
  expect(saved).toEqual({ vol: 0.5, muted: true });
});

test("a fresh manager restores persisted volume and mute", () => {
  const storage = new FakeStorage();
  storage.setItem("assetgen.audio", JSON.stringify({ vol: 0.3, muted: true }));
  const els = new Map<string, FakeEl>();
  const manifest = { theme: "theme.mp3", travel: "travel.mp3", bank: "bank.mp3" };
  const mgr = new AudioManager(manifest, {
    fadeMs: 0, storage,
    factory: (src) => { const el = new FakeEl(); els.set(src, el); return el; },
  });
  mgr.play("bank"); // muted → volume 0
  expect(els.get("bank.mp3")!.volume).toBe(0);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun test game/ui/lib/audio.test.ts`
Expected: FAIL — `mgr.toggleMute is not a function` / persisted state not restored.

- [ ] **Step 3: Write the minimal implementation**

In `game/ui/lib/audio.ts`, load persisted state at the end of the constructor — add after `this.fadeMs = ...`:

```ts
    this.load();
```

Then add these methods to the `AudioManager` class (e.g. after `playTravel`):

```ts
  /** Master volume, 0..1. */
  setVolume(v: number): void {
    this.vol = Math.max(0, Math.min(1, v));
    this.applyVolume();
    this.persist();
  }

  mute(on: boolean): void {
    this.muted = on;
    this.applyVolume();
    this.persist();
  }

  toggleMute(): void {
    this.mute(!this.muted);
  }

  private applyVolume(): void {
    const el = this.currentEl();
    if (el) el.volume = this.muted ? 0 : this.vol;
  }

  private persist(): void {
    this.store?.setItem(PERSIST_KEY, JSON.stringify({ vol: this.vol, muted: this.muted }));
  }

  private load(): void {
    const raw = this.store?.getItem(PERSIST_KEY);
    if (!raw) return;
    try {
      const { vol, muted } = JSON.parse(raw);
      if (typeof vol === "number") this.vol = vol;
      if (typeof muted === "boolean") this.muted = muted;
    } catch { /* ignore corrupt persisted audio settings */ }
  }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun test game/ui/lib/audio.test.ts`
Expected: PASS — 7 tests.

- [ ] **Step 5: Commit**

```bash
git add game/ui/lib/audio.ts game/ui/lib/audio.test.ts
git commit -m "feat(sound): volume, mute, and localStorage persistence

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Autoplay unlock

**Files:**
- Modify: `game/ui/lib/audio.ts`
- Test: `game/ui/lib/audio.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `game/ui/lib/audio.test.ts`:

```ts
// Flush microtasks (the play() promise + its .then/.catch) via a macrotask.
const flush = () => new Promise((r) => setTimeout(r, 0));

test("a blocked first play retries on unlock()", async () => {
  const els = new Map<string, FakeEl>();
  const manifest = { theme: "theme.mp3", travel: "travel.mp3", bank: "bank.mp3" };
  const mgr = new AudioManager(manifest, {
    fadeMs: 0, storage: new FakeStorage(),
    factory: (src) => {
      const el = new FakeEl();
      if (src === "theme.mp3") el.rejectPlay = true; // browser blocks the first track
      els.set(src, el);
      return el;
    },
  });
  const theme = () => els.get("theme.mp3")!;

  mgr.play("theme");
  await flush();
  expect(theme().playCount).toBe(1); // attempted once, blocked

  // Player interacts → audio unlocks → pending track retries (now allowed).
  theme().rejectPlay = false;
  mgr.unlock();
  await flush();
  expect(theme().playCount).toBe(2);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun test game/ui/lib/audio.test.ts`
Expected: FAIL — `mgr.unlock is not a function`.

- [ ] **Step 3: Write the minimal implementation**

In `game/ui/lib/audio.ts`, add a field near the other private fields:

```ts
  private pendingKey: string | null = null;
  private unlocked = false;
  private unlockBound = false;
```

Replace the `start` method body's play call. Change:

```ts
    void el.play();
```

to:

```ts
    el.play().then(() => {
      this.unlocked = true;
      this.pendingKey = null;
    }).catch(() => {
      // Autoplay blocked (only ever the first track). Remember it and wait
      // for the first user interaction to retry.
      this.pendingKey = key;
      this.bindUnlock();
    });
```

Then add these methods to the class:

```ts
  /** Retry a track that the browser blocked, once the user has interacted. */
  unlock(): void {
    if (this.unlocked || !this.pendingKey) return;
    this.start(this.pendingKey);
  }

  // Attach one-time interaction listeners that call unlock(). Guarded so the
  // pure class never touches the DOM under bun test.
  private bindUnlock(): void {
    if (this.unlockBound || typeof window === "undefined") return;
    this.unlockBound = true;
    const handler = () => {
      this.unlock();
      if (this.unlocked) {
        window.removeEventListener("pointerdown", handler);
        window.removeEventListener("keydown", handler);
      }
    };
    window.addEventListener("pointerdown", handler);
    window.addEventListener("keydown", handler);
  }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun test game/ui/lib/audio.test.ts`
Expected: PASS — 8 tests.

- [ ] **Step 5: Commit**

```bash
git add game/ui/lib/audio.ts game/ui/lib/audio.test.ts
git commit -m "feat(sound): autoplay-unlock retry on first interaction

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Preload the travel track

**Files:**
- Modify: `game/ui/lib/audio.ts`
- Test: `game/ui/lib/audio.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `game/ui/lib/audio.test.ts`:

```ts
test("the travel track is preloaded at construction but not played", () => {
  const { mgr, el } = makeManager();
  expect(el("travel")).toBeDefined();   // element created eagerly
  expect(el("travel")!.playCount).toBe(0); // but not playing yet
  void mgr; // constructed is enough
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun test game/ui/lib/audio.test.ts`
Expected: FAIL — `el("travel")` is `undefined` (not created until first play).

- [ ] **Step 3: Write the minimal implementation**

In `game/ui/lib/audio.ts`, at the end of the constructor add (after `this.load();`):

```ts
    // Travel is used constantly and must be instant — create (load) it now.
    if (this.manifest.travel) this.el("travel");
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun test game/ui/lib/audio.test.ts`
Expected: PASS — 9 tests.

- [ ] **Step 5: Commit**

```bash
git add game/ui/lib/audio.ts game/ui/lib/audio.test.ts
git commit -m "feat(sound): preload the travel track at construction

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Vite glue — the `audio` singleton

**Files:**
- Create: `game/ui/lib/sound.ts`

No unit test (Vite-only mp3 imports). Verified by `bun run ui:check` and at runtime.

- [ ] **Step 1: Create the singleton glue file**

Create `game/ui/lib/sound.ts`:

```ts
// game/ui/lib/sound.ts
// Vite glue: resolves the mp3 URLs at build time and builds the app-wide
// AudioManager singleton. Import { audio } anywhere to drive playback.
// (The testable mechanics live in ./audio.ts.)
import { AudioManager } from "./audio";
import themeUrl from "../../../assets/sound/main_theme.mp3?url";
import travelUrl from "../../../assets/sound/traveling.mp3?url";
import employmentUrl from "../../../assets/sound/employment_office.mp3?url";

// Manifest keys are `theme`, `travel`, and building ids (node id === building
// id). Buildings absent here fall back to the theme until their track exists.
const manifest: Record<string, string> = {
  theme: themeUrl,
  travel: travelUrl,
  employment: employmentUrl,
};

export const audio = new AudioManager(manifest);
```

- [ ] **Step 2: Type-check the UI**

Run: `bun run ui:check`
Expected: no new errors referencing `sound.ts` or `audio.ts`.

- [ ] **Step 3: Commit**

```bash
git add game/ui/lib/sound.ts
git commit -m "feat(sound): app-wide audio singleton with track manifest

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Wire the three hook points

**Files:**
- Modify: `game/ui/stores/game.svelte.ts` (`goTo` ~line 153, `openBuilding` ~line 165)
- Modify: `game/ui/App.svelte`

- [ ] **Step 1: Import the singleton in the store**

In `game/ui/stores/game.svelte.ts`, add to the imports near the top (next to the `roadWalk` import on line 9):

```ts
import { audio } from "../lib/sound";
```

- [ ] **Step 2: Play travel music when a walk begins**

In `goTo`, the current code is:

```ts
    if (!this.dispatch({ type: "moveTo", node })) return; // rejected (e.g. no time)
    await this.walkRoad(from, node); // travel first…
```

Change it to start the travel loop the instant the move is accepted:

```ts
    if (!this.dispatch({ type: "moveTo", node })) return; // rejected (e.g. no time)
    audio.playTravel(); // travel music for the duration of the walk
    await this.walkRoad(from, node); // travel first…
```

- [ ] **Step 3: Play the building's track on arrival**

The current `openBuilding` is:

```ts
  openBuilding(node: NodeId): void { screen = node; },
```

Change it to:

```ts
  openBuilding(node: NodeId): void { screen = node; audio.play(node); },
```

- [ ] **Step 4: Start the main theme on mount**

In `game/ui/App.svelte`, update the `<script>` block. Current:

```svelte
<script lang="ts">
  import Board from "./Board.svelte";
  import DialogPanel from "./DialogPanel.svelte";
  import Feedback from "./Feedback.svelte";
</script>
```

Change to:

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

- [ ] **Step 5: Type-check and run the existing test suite**

Run: `bun run ui:check && bun test`
Expected: UI check clean (no new errors); all bun tests pass (audio tests + existing engine tests).

- [ ] **Step 6: Commit**

```bash
git add game/ui/stores/game.svelte.ts game/ui/App.svelte
git commit -m "feat(sound): wire theme on mount, travel on move, track on arrival

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: Verify in the real game (Playwright)

**Files:** none (manual behavioral verification).

- [ ] **Step 1: Start the dev server**

Run: `bun run ui:dev` (serves on port 5173).

- [ ] **Step 2: Drive the game in a browser**

Using the Playwright MCP tools:
1. Navigate to `http://localhost:5173`.
2. Click anywhere once (satisfies autoplay unlock) and confirm via the page's audio state that a track is playing — evaluate in-page:
   `document.querySelectorAll('audio').length` is not reliable (elements are created via `new Audio`, not in the DOM). Instead expose nothing new; verify by listening or by reading `currentTime` advancing on the manager. Practical check: in the page console run
   `[...performance.getEntriesByType('resource')].filter(r => r.name.endsWith('.mp3')).map(r => r.name)`
   and confirm `main_theme.mp3` loaded after the first click.
3. Click a building hit-box to travel. Confirm `traveling.mp3` appears in the loaded mp3 resources during the walk.
4. After arrival at the Employment Office, confirm `employment_office.mp3` loaded.
5. Travel to a building with no track (e.g. the Bank) and confirm no new mp3 loads — it reuses `main_theme.mp3` (theme fallback).

- [ ] **Step 3: Record the result**

Confirm in the conversation: theme on load (after first click), travel track during walks, employment track on arrival there, theme fallback elsewhere. If any step fails, debug before considering the feature complete.

---

## Notes for the implementer

- **Do not** add mp3 imports to `audio.ts` — they break `bun test`. All Vite-coupled imports live in `sound.ts` only.
- `audio.play(key)` is a no-op when `key` is already current, so re-opening the same building never restarts its music.
- Mute keeps the track playing at volume 0 (position preserved); it never pauses.
- The `setVolume`/`mute`/`toggleMute` API exists for a future settings control; no UI for it is in this scope.
