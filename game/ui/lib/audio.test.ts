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
