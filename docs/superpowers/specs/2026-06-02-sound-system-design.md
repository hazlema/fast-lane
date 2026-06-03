# Sound System Design

**Date:** 2026-06-02
**Status:** Approved, ready for implementation plan

## Goal

A background-music system for the Jones-clone game that any part of the app can
call. One looping track plays at a time, chosen by game context: a main theme, a
per-building track, and a traveling track that plays while the player walks
between buildings. Audio swaps often as the player moves, so the call site must
be dead simple.

No sound effects in this scope — music bed only.

## Behavior

- **Every location loops** its track while the player is parked there.
- **Travel interrupts:** when the player heads somewhere, the current track
  stops, the `travel` track plays for the whole walk, and the destination's
  track starts on arrival.
- **Main theme** plays at game start; it is the first thing heard.
- **Hard cut** between tracks (stop current, start next), with a ~60ms fade on
  the stop only to avoid the browser's click/pop on an abrupt pause. Not
  perceived as a crossfade.
- **Unmapped buildings fall back to the main theme** so music never cuts to
  awkward silence while tracks are still being authored.

## Architecture — Approach A: imperative singleton

One file, `game/ui/lib/audio.ts`, exporting a single instance:

```ts
export const audio = new AudioManager();
```

Any file does `import { audio }` and calls it. Pure TypeScript, no Svelte
dependency, so it is unit-testable under `bun test`.

### Track manifest

A map of key → mp3 URL (Vite resolves URLs at build time). Keys are `theme`,
`travel`, and building ids.

Current tracks in `assets/sound/`:

| Key          | File                    |
|--------------|-------------------------|
| `theme`      | `main_theme.mp3`        |
| `travel`     | `traveling.mp3`         |
| `employment` | `employment_office.mp3` |

Building ids (node id === building id, so `audio.play(node)` maps directly):
`highsec`, `rentoffice`, `lowcost`, `pawn`, `discount`, `frosty`, `offrack`,
`electronics`, `university`, `employment`, `factory`, `bank`, `tryandsave`,
`dealership`. Any id absent from the manifest → falls back to `theme`.
(`frosty` and `dealership`/Tesla are original compositions, authored later.)

### Playback

- One looping `HTMLAudioElement` per track (`element.loop = true`).
- `travel` is **preloaded eagerly** (used constantly, must be instant). Other
  tracks load lazily on first play, then stay cached.
- Switching: if the requested key is already the current track, no-op (so
  re-arriving never restarts the music). Otherwise fade-stop the current element
  and start the new one.

### Autoplay unlock

Browsers block audio until the first user interaction. Only the very first track
(the theme) is ever at risk. `play()` attempts to start; if the returned promise
rejects, the manager stores the pending key and attaches one-time
`pointerdown`/`keydown` listeners that retry on the next interaction. After the
first success, the system is unlocked permanently.

## Public API

```ts
audio.play(key)          // play looping track for key (theme | building id); no-op if already current
audio.playTravel()       // convenience: play the travel loop
audio.stop()             // fade out, go silent
audio.setVolume(0..1)    // master volume
audio.mute(bool)         // set mute
audio.toggleMute()       // flip mute
```

Volume and mute persist to `localStorage` under one key so the player's choice
survives a reload.

## Wiring — three hook points in `gameStore`

The only sound calls outside the class:

1. `goTo()` — when travel begins → `audio.playTravel()`
2. `openBuilding(node)` — on arrival → `audio.play(node)`
3. game start → `audio.play("theme")`

## Testing

The manager takes an **injectable element factory**, defaulting to the real
`HTMLAudioElement`. Tests pass a fake that records `play`/`pause`/`volume`/
`currentTime`. Under `bun test`:

- `play("bank")` twice → second call is a no-op (no restart).
- Switching tracks stops the previous element and starts the new one.
- `toggleMute()` silences without losing track position.
- A blocked first `play()` registers the unlock listener and retries on the
  next interaction.

Then **verify in the real game with Playwright**: click a building, confirm the
audio swaps to `travel` during the walk and to the destination track on arrival.

## Out of scope

- Sound effects (coins, clicks, dings).
- Crossfades / ducking / layered audio.
- Per-track volume.
