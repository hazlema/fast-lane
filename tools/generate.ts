import OpenAI from "openai";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

// Construct the client lazily so this module imports fine without a key — the
// OpenAI SDK throws at construction when OPENAI_API_KEY is missing. Only the
// generation path needs it; the /tools route shows a friendly notice instead.
let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not set — add it to .env");
    }
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}

const ROOT = import.meta.dir;
export const SOURCE_DIR = path.join(ROOT, "generated", "source");
export const PROMPT_DIR = path.join(ROOT, "generated", "prompts");
export const CROPPED_DIR = path.join(ROOT, "generated", "cropped");

await mkdir(SOURCE_DIR, { recursive: true });
await mkdir(PROMPT_DIR, { recursive: true });
await mkdir(CROPPED_DIR, { recursive: true });

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80) || "asset";
}

export function buildPrompt(input: {
  description: string;
  signText: string;
  kind?: string;
}): string {
  if (input.kind === "prop") {
    return `
Create a 2D front-facing cartoon decorative prop asset for a life-sim board game inspired by 1990s management games.

Subject:
${input.description}

Style rules:
- A single standalone object, centered in frame
- Straight-on front view
- Fill 80% to 95% of the canvas
- Leave only a small transparent or plain margin around the asset
- The bottom of the object should rest on a flat baseline
- Plain flat solid background, preferably light gray or off-white
- No scenery, horizon, sky, street, or decorative background
- No cast shadow touching the background
- No isometric angle
- No rotated perspective
- Kids-cartoon style
- Clean thick outline
- Bright readable shapes
- Slightly chunky toy-like proportions
- Consistent lighting from upper left
- Must match the look of the cartoon buildings in the same board game
- No people
- No cars
- No text or signage unless explicitly described

Avoid:
isometric view, angled camera, realistic rendering, photorealism, complex background, street scene, sky, people, vehicles, heavy perspective, dramatic lighting.
`.trim();
  }

  return `
Create a 2D front-facing cartoon game asset for a life-sim board game inspired by 1990s management games.

Subject:
${input.description}

Required sign text:
"${input.signText}"

Style rules:
- Straight-on front view of the building
- Fill 85% to 95% of the canvas height
- Leave only a small transparent or plain margin around the asset
- The bottom of the building should sit near the same baseline as other assets
- Plain flat solid background, preferably light gray or off-white
- No scenery, horizon, sky, street, or decorative background
- No cast shadow touching the background
- No isometric angle
- No rotated perspective
- Kids-cartoon style
- Clean thick outline
- Bright readable shapes
- Slightly chunky toy-like proportions
- Centered in frame
- Building sits on a simple flat base or sidewalk
- Consistent lighting from upper left
- Sign text must be large, simple, and readable
- No people
- No cars
- No background scenery
- No sky
- No street scene
- No shadows outside the asset

Avoid:
isometric view, angled camera, realistic rendering, photorealism, tiny unreadable text, complex background, street scene, sky, people, vehicles, heavy perspective, dramatic lighting.
`.trim();
}

export interface GenerateInput {
  assetName: string;
  signText: string;
  description: string;
  model: string;
  size: string;
  quality: string;
  kind?: string; // "building" (default) or "prop"
}

export interface GenerateResult {
  imagePath: string;
  promptPath: string;
  imageUrl: string;
  prompt: string;
}

export async function generateAsset(input: GenerateInput): Promise<GenerateResult> {
  const { assetName, signText, description, model, size, quality, kind } = input;

  const bg = model == "gpt-image-2" ? "auto" : "transparent";

  const prompt = buildPrompt({ description, signText, kind });
  const slug = slugify(assetName);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const baseName = `${slug}_${stamp}`;

  console.log(`Model ${model}, Size: ${size}, BG: ${bg}\nPrompt: ${prompt}`);

  const result = await getOpenAI().images.generate({
    model,
    prompt,
    size,
    quality,
    background: bg,
    output_format: "png"
  });

  const b64 = result.data?.[0]?.b64_json;

  if (!b64) {
    throw new Error("No image data returned from API.");
  }

  const pngBytes = Buffer.from(b64, "base64");

  const imagePath = path.join(SOURCE_DIR, `${baseName}.png`);
  const promptPath = path.join(PROMPT_DIR, `${baseName}.txt`);

  await writeFile(imagePath, pngBytes);
  await writeFile(promptPath, prompt, "utf8");

  return {
    imagePath,
    promptPath,
    imageUrl: `/generated/source/${baseName}.png`,
    prompt
  };
}
