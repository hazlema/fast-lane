// game/ui/lib/sound.ts
// Vite glue: resolves the mp3 URLs at build time and builds the app-wide
// AudioManager singleton. Import { audio } anywhere to drive playback.
// (The testable mechanics live in ./audio.ts.)
import { AudioManager } from "./audio";
import themeUrl from "../../../assets/sound/main_theme.mp3?url";
import travelUrl from "../../../assets/sound/traveling.mp3?url";
import employmentUrl from "../../../assets/sound/employment_office.mp3?url";
import frostyUrl from "../../../assets/sound/frosty_burger.mp3?url";
import tryandsaveUrl from "../../../assets/sound/try_and_save.mp3?url";

// Manifest keys are `theme`, `travel`, and building ids (node id === building
// id). Buildings absent here fall back to the theme until their track exists.
const manifest: Record<string, string> = {
  theme: themeUrl,
  travel: travelUrl,
  employment: employmentUrl,
  frosty: frostyUrl,
  tryandsave: tryandsaveUrl,
};

export const audio = new AudioManager(manifest);
