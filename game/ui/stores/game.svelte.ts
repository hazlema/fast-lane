// game/ui/stores/game.svelte.ts
import { applyAction, type Action } from "../../engine/reducer";
import { newGame as createGame } from "../../engine/loop";
import { type GameState, type Player, type Stat } from "../../engine/state";
import { WORLD } from "../../data/world";
import { NODE_XY, type NodeId } from "../../data/board";
import { monthOf } from "../../engine/calendar";
import { CONFIG } from "../../data/config";
import { nodeOffsets, shorterArc, wrap, type Pt } from "../lib/roadWalk";

const START_NODE: NodeId = "lowcost"; // you begin at home (you start renting Low Cost Housing)
const WALK_MS_PER_HALF = 2200; // time to traverse half the loop; scaled by arc length

// Screen is "goals" | "home" | "won" | "lost" | a building id (NodeId === building id).
type Screen = string;

function newSetupGame(): GameState {
  // Starts in phase "setup": the GoalsScreen calls startGame() to begin.
  return createGame({ playerName: "You", startNode: START_NODE, seed: Date.now() >>> 0, startHousing: "lowcost" });
}

// Saving/resuming is intentionally DISABLED during development: every load
// starts a fresh game at goal-setup so playtests aren't tainted by a stale
// resumed save. (Clear any old save left over from earlier builds.)
if (typeof localStorage !== "undefined") localStorage.removeItem("jones-save-v1");

let game = $state<GameState>(newSetupGame());
let screen = $state<Screen>("goals");
let lastError = $state<string | null>(null);
let tokenXY = $state<Pt>({ ...NODE_XY[START_NODE] });
let walking = $state(false);

// Transient feedback signal (e.g. job-application result, a purchase, a
// newspaper headline). The id lets the overlay re-trigger even when the text
// repeats. Tones: good = confetti, bad/news = centered dialog, info = toast.
type NoticeTone = "good" | "bad" | "news" | "info";
type Notice = { id: number; tone: NoticeTone; title: string; text: string };
let notice = $state<Notice | null>(null);
let noticeSeq = 0;

// Road path + per-node offsets, attached by Board.svelte once the SVG mounts.
let roadPath: SVGPathElement | null = null;
let roadLen = 0;
let offsets: Record<NodeId, number> | null = null;

function persist(): void {
  /* saving disabled during development — no-op */
}

function pointAt(len: number): Pt {
  const p = roadPath!.getPointAtLength(wrap(len, roadLen));
  return { x: p.x, y: p.y };
}

const raf = (cb: FrameRequestCallback) => requestAnimationFrame(cb);

export const gameStore = {
  get state(): GameState { return game; },
  get player(): Player { return game.players[game.current]; },
  get error(): string | null { return lastError; },
  get tokenXY(): Pt { return tokenXY; },
  get walking(): boolean { return walking; },
  get screen(): Screen { return screen; },
  get economyIndex(): number { return game.economyIndex; },
  get month(): number { return monthOf(game.week); },
  get notice(): Notice | null { return notice; },

  // Raise a transient bit of feedback for the overlay to show.
  pushNotice(tone: NoticeTone, text: string, title = ""): void { notice = { id: ++noticeSeq, tone, text, title }; },

  // Buy an item and show feedback: a toast for ordinary purchases, the headline
  // popup for a newspaper.
  buy(itemId: string): void {
    const item = WORLD.items[itemId];
    if (!this.dispatch({ type: "buy", item: itemId })) {
      this.pushNotice("bad", lastError ?? "Couldn't buy that.", "No deal");
      return;
    }
    if (itemId === "newspaper") {
      const headline = [...game.log].reverse().find((e) => e.text.startsWith("📰"))?.text ?? "📰 Read all about it!";
      this.pushNotice("news", headline.replace(/^📰\s*/, ""), "📰 Extra! Extra!");
    } else {
      this.pushNotice("info", `Bought ${item?.name ?? "item"}.`);
    }
  },

  // Pawn an item for cash, with a toast.
  sell(itemId: string): void {
    const item = WORLD.items[itemId];
    const refund = item ? Math.round(item.cost * CONFIG.pawnSellFraction) : 0;
    if (this.dispatch({ type: "sell", item: itemId })) {
      this.pushNotice("info", `Pawned ${item?.name ?? "item"} for $${refund}.`);
    } else {
      this.pushNotice("bad", lastError ?? "Couldn't sell that.", "No deal");
    }
  },

  // Relax at home for a happiness lift, with a toast.
  relax(): void {
    const hasTv = this.player.inventory.includes("tv") || this.player.inventory.includes("tv_used");
    const gain = CONFIG.relaxHappiness + (hasTv ? CONFIG.relaxTvBonus : 0);
    if (this.dispatch({ type: "relax" })) {
      this.pushNotice("info", `Relaxed at home. 😀 +${gain} happiness.`);
    } else {
      this.pushNotice("bad", lastError ?? "Couldn't relax.", "Not now");
    }
  },

  // Board.svelte calls this once with the SVG <path id="Road"> element.
  attachRoad(path: SVGPathElement): void {
    roadPath = path;
    roadLen = path.getTotalLength();
    offsets = nodeOffsets(WORLD.graph.nodes, NODE_XY, (l) => {
      const pt = path.getPointAtLength(l);
      return { x: pt.x, y: pt.y };
    }, roadLen);
    tokenXY = { ...NODE_XY[game.players[game.current].position] };
  },

  // Dry-run a reducer action without committing — used to disable invalid rows.
  preview(action: Action) {
    return applyAction(game, action, WORLD);
  },

  // Commit an action. Returns true on success; sets lastError on rejection.
  dispatch(action: Action): boolean {
    const before = this.player.timeLeft;
    const r = applyAction(game, action, WORLD);
    if (!r.ok) { lastError = r.reason ?? "Not allowed."; return false; }
    game = r.state; lastError = null;
    // Spent your last time unit? The week's over — end it automatically.
    // (Travel is excluded: goTo ends it after the walk, not mid-step.)
    if (action.type !== "moveTo" && game.phase === "playing" && before > 0 && this.player.timeLeft <= 0) {
      this.endWeek();
    }
    return true;
  },

  // Goal-setup → begin the week.
  startGame(goals: Record<Stat, number>): void {
    if (this.dispatch({ type: "setGoals", goals })) {
      screen = "home";
      persist();
    }
  },

  goHome(): void { screen = "home"; },

  // Walk to a building: the engine charges travel time instantly, then the
  // token tweens along the Road path. The building's screen only opens once
  // we ARRIVE — the dialog stays on its current content while travelling
  // (a future travel animation/audio will play during the walk).
  async goTo(node: NodeId): Promise<void> {
    if (walking || game.phase !== "playing") return;
    const from = game.players[game.current].position;
    if (from === node) { this.openBuilding(node); return; }
    if (!this.dispatch({ type: "moveTo", node })) return; // rejected (e.g. no time)
    await this.walkRoad(from, node); // travel first…
    // Spent your last time getting here? End the week on arrival rather than
    // opening a building you can't act in.
    if (game.phase === "playing" && this.player.timeLeft <= 0) this.endWeek();
    else this.openBuilding(node); // …otherwise open the building
  },

  openBuilding(node: NodeId): void { screen = node; },

  async walkRoad(from: NodeId, to: NodeId): Promise<void> {
    if (!roadPath || !offsets) { tokenXY = { ...NODE_XY[to] }; return; }
    const fromOff = offsets[from];
    const delta = shorterArc(fromOff, offsets[to], roadLen);
    const dur = Math.max(300, Math.round((Math.abs(delta) / (roadLen / 2)) * WALK_MS_PER_HALF));
    walking = true;
    await new Promise<void>((resolve) => {
      const t0 = performance.now();
      const tick = (now: number) => {
        const k = Math.min(1, (now - t0) / dur);
        tokenXY = pointAt(fromOff + delta * k);
        if (k < 1) raf(tick);
        else { tokenXY = { ...NODE_XY[to] }; resolve(); }
      };
      raf(tick);
    });
    walking = false;
  },

  endWeek(): void {
    if (this.dispatch({ type: "endWeek" })) {
      screen = game.phase === "won" ? "won" : game.phase === "lost" ? "lost" : "home";
      // The engine returned the player home; snap the token there to match.
      tokenXY = { ...NODE_XY[game.players[game.current].position] };
      // Surface a weekend event / falling sick as a popup.
      if (game.phase === "playing") {
        const ev = [...game.log].reverse().find((e) => e.week === game.week && /^[🚨🎵💰🤢🏭📉]/u.test(e.text));
        if (ev) {
          const good = ev.text.startsWith("🎵") || ev.text.startsWith("💰");
          const title = ev.text.startsWith("🤢") ? "Food poisoning!"
            : ev.text.startsWith("🏭") || ev.text.startsWith("📉") ? "Hard times"
            : good ? "Lucky weekend!" : "Watch out!";
          this.pushNotice(good ? "good" : "bad", ev.text.replace(/^\S+\s*/u, ""), title);
        }
      }
      persist(); // autosave at each week-end
    }
  },

  payRent(): void {
    const cashBefore = this.player.cash;
    if (this.dispatch({ type: "payRent" })) {
      const paid = cashBefore - this.player.cash;
      const remaining = this.player.rentDue;
      if (remaining > 0) this.pushNotice("info", `Paid $${paid} — $${remaining} rent still due.`, "Partial payment");
      else this.pushNotice("good", `Rent paid in full ($${paid}).`, "Rent paid");
      persist();
    } else {
      this.pushNotice("bad", lastError ?? "Couldn't pay rent.", "No payment");
    }
  },

  // Sign a lease (move in), with a toast.
  rentUnit(id: string): void {
    const h = WORLD.housing[id];
    if (this.dispatch({ type: "rent", unit: id })) {
      this.pushNotice("info", `Moved into ${h?.name ?? "your new place"} — rent $${h?.monthlyRent}/mo.`, "New lease");
    } else {
      this.pushNotice("bad", lastError ?? "Couldn't sign that lease.", "No deal");
    }
  },

  newGame(): void {
    game = newSetupGame();
    screen = "goals";
    lastError = null;
    walking = false;
    tokenXY = { ...NODE_XY[START_NODE] };
  },
};
