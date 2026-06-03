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
import electronicsUrl from "../../../assets/sound/electronics.mp3?url";
import bankUrl from "../../../assets/sound/bank.mp3?url";
import rentofficeUrl from "../../../assets/sound/rent_office.mp3?url";
import highsecUrl from "../../../assets/sound/high_security.mp3?url";
import lowcostUrl from "../../../assets/sound/low_security.mp3?url";
import universityUrl from "../../../assets/sound/university.mp3?url";
import factoryUrl from "../../../assets/sound/factory.mp3?url";

// Manifest keys are `theme`, `travel`, and building ids (node id === building
// id). Buildings absent here fall back to the theme until their track exists.
const manifest: Record<string, string> = {
  theme: themeUrl,
  travel: travelUrl,
  employment: employmentUrl,
  frosty: frostyUrl,
  tryandsave: tryandsaveUrl,
  electronics: electronicsUrl,
  bank: bankUrl,
  rentoffice: rentofficeUrl,
  highsec: highsecUrl,
  lowcost: lowcostUrl,
  university: universityUrl,
  factory: factoryUrl,
};

export const audio = new AudioManager(manifest);
