// game/ui/lib/fx.ts
// One-shot sound effects (accept/deny chirps). Unlike AudioManager's looping
// background tracks, an effect just fires and forgets. FX carry their own
// volume/mute, persisted separately from the music so the menu can control
// each independently. Pure TS + injectable element/storage so it is testable
// under bun (no real DOM). The Vite-coupled singleton lives in ./sound.ts.
import type { Storage } from "./audio";

// The slice of HTMLAudioElement we depend on — lets tests inject a fake.
export interface FxEl {
  volume: number;
  currentTime: number;
  play(): Promise<void>;
}

export type FxFactory = (src: string) => FxEl;

export interface FxOpts {
  factory?: FxFactory;
  storage?: Storage;
}

const PERSIST_KEY = "assetgen.fx";

export class FxManager {
  private manifest: Record<string, string>;
  private factory: FxFactory;
  private store: Storage | null;
  private cache = new Map<string, FxEl>();

  private vol = 1;
  private muted = false;

  constructor(manifest: Record<string, string>, opts: FxOpts = {}) {
    this.manifest = manifest;
    this.factory = opts.factory ?? ((src) => new Audio(src) as unknown as FxEl);
    this.store = opts.storage ?? (typeof localStorage !== "undefined" ? localStorage : null);
    this.load();
  }

  /** Fire a one-shot effect. Unknown keys and muted FX are silent no-ops. */
  play(key: string): void {
    if (!this.manifest[key] || this.muted) return;
    let el = this.cache.get(key);
    if (!el) {
      el = this.factory(this.manifest[key]);
      this.cache.set(key, el);
    }
    el.currentTime = 0; // rewind in case it's mid-play from a recent fire
    el.volume = this.vol;
    // Swallow rejections: if autoplay is still locked the chirp just doesn't
    // happen — not worth the unlock machinery for a feedback blip.
    el.play().catch(() => {});
  }

  /** FX volume, 0..1. */
  setVolume(v: number): void {
    this.vol = Math.max(0, Math.min(1, v));
    this.persist();
  }

  getVolume(): number {
    return this.vol;
  }

  mute(on: boolean): void {
    this.muted = on;
    this.persist();
  }

  toggleMute(): void {
    this.mute(!this.muted);
  }

  isMuted(): boolean {
    return this.muted;
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
    } catch { /* ignore corrupt persisted FX settings */ }
  }
}
