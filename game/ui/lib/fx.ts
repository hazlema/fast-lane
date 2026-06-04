// game/ui/lib/fx.ts
// One-shot sound effects (accept/deny chirps). Unlike AudioManager's looping
// background tracks, an effect just fires and forgets. Volume/mute are read
// from injected getters at play time so FX always follow the master audio
// settings without duplicating persistence. Pure TS + injectable element so
// it is testable under bun (no real DOM). The Vite-coupled singleton lives
// in ./sound.ts.

// The slice of HTMLAudioElement we depend on — lets tests inject a fake.
export interface FxEl {
  volume: number;
  currentTime: number;
  play(): Promise<void>;
}

export type FxFactory = (src: string) => FxEl;

export interface FxOpts {
  factory?: FxFactory;
  volume?: () => number; // master volume getter, 0..1 (default: full)
  muted?: () => boolean; // master mute getter (default: never)
}

export class FxManager {
  private manifest: Record<string, string>;
  private factory: FxFactory;
  private volume: () => number;
  private muted: () => boolean;
  private cache = new Map<string, FxEl>();

  constructor(manifest: Record<string, string>, opts: FxOpts = {}) {
    this.manifest = manifest;
    this.factory = opts.factory ?? ((src) => new Audio(src) as unknown as FxEl);
    this.volume = opts.volume ?? (() => 1);
    this.muted = opts.muted ?? (() => false);
  }

  /** Fire a one-shot effect. Unknown keys and muted audio are silent no-ops. */
  play(key: string): void {
    if (!this.manifest[key] || this.muted()) return;
    let el = this.cache.get(key);
    if (!el) {
      el = this.factory(this.manifest[key]);
      this.cache.set(key, el);
    }
    el.currentTime = 0; // rewind in case it's mid-play from a recent fire
    el.volume = this.volume();
    // Swallow rejections: if autoplay is still locked the chirp just doesn't
    // happen — not worth the unlock machinery for a feedback blip.
    el.play().catch(() => {});
  }
}
