// game/ui/stores/menu.svelte.ts
// Tiny UI store: whether the Escape settings overlay is showing. Kept separate
// from the game-logic store so a future trigger (gear button, New Game) has one
// obvious place to call.
let open = $state(false);

export const menuStore = {
  get open(): boolean { return open; },
  toggle(): void { open = !open; },
  close(): void { open = false; },
};
