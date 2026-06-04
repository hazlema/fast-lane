// game/ui/lib/sound.ts
// Vite glue: resolves the sound URLs at build time and builds the app-wide
// singletons — `audio` for looping background music, `fx` for one-shot
// effects. (The testable mechanics live in ./audio.ts and ./fx.ts.)
import { AudioManager } from "./audio";
import { FxManager } from "./fx";
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
import dealershipUrl from "../../../assets/sound/tesla_dealership.mp3?url";
import pawnUrl from "../../../assets/sound/pawn_shop.mp3?url";
import discountUrl from "../../../assets/sound/discount_store.mp3?url";
import offrackUrl from "../../../assets/sound/off_the_rack.mp3?url";
import weekendUrl from "../../../assets/sound/weekend_over.mp3?url";
import acceptUrl from "../../../assets/FX/accept.wav?url";
import denyUrl from "../../../assets/FX/deny.wav?url";

// Manifest keys are `theme`, `travel`, `weekend` (played after the week ends),
// and building ids (node id === building id). Buildings absent here fall back
// to the theme until their track exists.
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
  dealership: dealershipUrl,
  pawn: pawnUrl,
  discount: discountUrl,
  offrack: offrackUrl,
  weekend: weekendUrl,
};

export const audio = new AudioManager(manifest);

// One-shot effects: `accept` for actions that succeed, `deny` for rejections.
// FX follow the music manager's volume/mute, read live at each play.
export const fx = new FxManager(
  { accept: acceptUrl, deny: denyUrl },
  { volume: () => audio.getVolume(), muted: () => audio.isMuted() },
);
