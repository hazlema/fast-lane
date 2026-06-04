import { test, expect } from "bun:test";
import { FxManager, type FxEl } from "./fx";

// Records every interaction so tests can assert on playback behavior.
class FakeEl implements FxEl {
  volume = 1;
  currentTime = 5; // pretend it played before, so replays must rewind
  playCount = 0;
  async play(): Promise<void> { this.playCount++; }
}

// Build a manager whose elements are FakeEls we can inspect by key.
function makeFx(opts: { volume?: () => number; muted?: () => boolean } = {}) {
  const els = new Map<string, FakeEl>();
  const manifest = { accept: "accept.wav", deny: "deny.wav" };
  const fx = new FxManager(manifest, {
    ...opts,
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

test("play() follows the injected master volume", () => {
  const { fx, el } = makeFx({ volume: () => 0.4 });
  fx.play("accept");
  expect(el("accept")!.volume).toBe(0.4);
});

test("muted master audio suppresses effects entirely", () => {
  const { fx, el } = makeFx({ muted: () => true });
  fx.play("accept");
  expect(el("accept")?.playCount ?? 0).toBe(0);
});
