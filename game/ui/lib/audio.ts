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
    this.load();
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
