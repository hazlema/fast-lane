import { test, expect } from "bun:test";
import { FxManager, type FxEl } from "./fx";
import type { Storage } from "./audio";

// Records every interaction so tests can assert on playback behavior.
class FakeEl implements FxEl {
  volume = 1;
  currentTime = 5; // pretend it played before, so replays must rewind
  playCount = 0;
  async play(): Promise<void> { this.playCount++; }
}

class FakeStorage implements Storage {
  map = new Map<string, string>();
  getItem(k: string) { return this.map.get(k) ?? null; }
  setItem(k: string, v: string) { this.map.set(k, v); }
}

// Build a manager whose elements are FakeEls we can inspect by key.
function makeFx(storage: Storage = new FakeStorage()) {
  const els = new Map<string, FakeEl>();
  const manifest = { accept: "accept.wav", deny: "deny.wav" };
  const fx = new FxManager(manifest, {
    storage,
    factory: (src: string) => {
      const el = new FakeEl();
      els.set(src, el);
      return el;
    },
  });
  const el = (key: string) => els.get(manifest[key as keyof typeof manifest]);
  return { fx, el };
}

test("play() fires the one-shot at full volume by default", () => {
  const { fx, el } = makeFx();
  fx.play("accept");
  expect(el("accept")!.playCount).toBe(1);
  expect(el("accept")!.volume).toBe(1);
});

test("replaying rewinds to the start", () => {
  const { fx, el } = makeFx();
  fx.play("deny");
  fx.play("deny");
  expect(el("deny")!.playCount).toBe(2);
  expect(el("deny")!.currentTime).toBe(0);
});

test("an unknown key is a silent no-op", () => {
  const { fx, el } = makeFx();
  fx.play("kaboom");
  expect(el("kaboom")).toBeUndefined();
});

test("setVolume applies to subsequent plays", () => {
  const { fx, el } = makeFx();
  fx.setVolume(0.4);
  fx.play("accept");
  expect(el("accept")!.volume).toBe(0.4);
  expect(fx.getVolume()).toBe(0.4);
});

test("muting suppresses effects; unmuting restores them", () => {
  const { fx, el } = makeFx();
  fx.mute(true);
  expect(fx.isMuted()).toBe(true);
  fx.play("accept");
  expect(el("accept")?.playCount ?? 0).toBe(0);
  fx.toggleMute();
  fx.play("accept");
  expect(el("accept")!.playCount).toBe(1);
});

test("volume and mute persist, and a fresh manager restores them", () => {
  const storage = new FakeStorage();
  const a = makeFx(storage);
  a.fx.setVolume(0.3);
  a.fx.mute(true);
  const b = makeFx(storage); // new session, same storage
  expect(b.fx.getVolume()).toBe(0.3);
  expect(b.fx.isMuted()).toBe(true);
});
