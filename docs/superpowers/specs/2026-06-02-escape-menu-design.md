# Escape Menu Design

**Date:** 2026-06-02
**Status:** Approved, ready for implementation plan

## Goal

An overlay menu the player opens with the Escape key. Holds the audio controls
(mute toggle + volume slider) for the background-music system, plus a Resume
button. Structured so game actions (New Game / Restart) can be added later
without restructuring.

Because the game is turn-based (the engine only advances time on player
actions), there is nothing real-time to pause — this is a settings/menu overlay
layered on top of the game, not a true pause.

## Behavior

- **Escape toggles** the overlay open and closed, from anywhere: title/goals
  screen, mid-game, even during a walk animation.
- **Closes** three ways: Escape again, a Resume button, or clicking the dimmed
  backdrop. Clicks *inside* the panel do not close it.
- **Mute toggle** → `audio.toggleMute()`; its label/state reflects
  `audio.isMuted()`.
- **Volume slider** (0–100%) → `audio.setVolume(v)` live while dragging.
  Dragging the slider while muted **unmutes** (so a moving slider always makes
  sound). Volume and mute already persist to localStorage (from the sound
  system), so the menu's settings survive a reload.
- Opening the menu does **not** stop or pause the music; it controls it.

## Architecture

State for "is the overlay showing" lives in a small dedicated rune store, kept
separate from the game-logic store so game state stays about the game and a
future trigger (gear button, auto-open on New Game) has one place to call.

### Components

- **`game/ui/lib/audio.ts`** (modify) — add two getters:
  - `getVolume(): number` — current master volume (0–1).
  - `isMuted(): boolean` — current mute state.
  These let the UI read state it can only currently set. Unit-tested.

- **`game/ui/stores/menu.svelte.ts`** (create) — rune store, one
  responsibility (is the overlay open):
  - `open: boolean` (`$state`)
  - `toggle(): void`
  - `close(): void`

- **`game/ui/EscapeMenu.svelte`** (create) — the overlay:
  - Dimmed translucent backdrop covering the whole stage; clicking it calls
    `menu.close()`.
  - Centered card styled to match the game's existing panel. A `stopPropagation`
    on the card so inner clicks don't reach the backdrop.
  - Audio group: mute toggle (reads `audio.isMuted()`), volume slider (reads
    `audio.getVolume()`, drives `audio.setVolume()`), Resume button
    (`menu.close()`).
  - A marked insertion point (comment) for the future New Game / Restart group.
  - Renders only when `menu.open` is true.

- **`game/ui/App.svelte`** (modify) — render `<EscapeMenu />` on top of the
  stage; on mount attach a `window` `keydown` listener that calls
  `menu.toggle()` when the key is `Escape`, removed on destroy.

## Data Flow

1. Player presses Escape → App's keydown handler → `menu.toggle()` → `menu.open`
   flips → `EscapeMenu` shows/hides.
2. Player toggles mute / drags volume → `EscapeMenu` calls `audio.toggleMute()`
   / `audio.setVolume()` → `AudioManager` applies to the current track and
   persists to localStorage.
3. Player presses Escape / clicks Resume / clicks backdrop → `menu.close()` →
   overlay hides.

## Testing

- **Unit (`bun test`)** — the two new `AudioManager` getters:
  - `getVolume()` returns the value set by `setVolume()`.
  - `isMuted()` reflects `mute(true)` / `mute(false)` / `toggleMute()`.
- **Behavioral (Playwright)** — the store and Svelte component can't be
  meaningfully unit-tested under bun (runes need the Svelte compiler, same as
  the existing `game.svelte.ts`), so verify in the real game:
  - Press Escape → menu appears; press Escape again → it closes.
  - Toggle mute → current track silences; toggle again → returns to volume.
  - Drag the volume slider → level changes (and unmutes if muted).
  - Click the backdrop → closes. Click Resume → closes. Click inside the
    panel → stays open.

## Out of Scope

- New Game / Restart actions (structure for them; don't build them yet).
- Any true game-pause semantics (engine is turn-based).
- Per-track volume, audio settings beyond master volume + mute.
- A gear/settings button (Escape is the only trigger for now).
