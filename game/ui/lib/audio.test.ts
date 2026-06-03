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

test("the travel track is preloaded at construction but not played", () => {
  const { mgr, el } = makeManager();
  expect(el("travel")).toBeDefined();   // element created eagerly
  expect(el("travel")!.playCount).toBe(0); // but not playing yet
  void mgr; // constructed is enough
});
