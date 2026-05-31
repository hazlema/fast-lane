import path from "node:path";
import { mkdir, copyFile } from "node:fs/promises";

const ROOT = import.meta.dir;
const LAYOUT_FILE = path.join(ROOT, "layout.json");
const SOURCE_DIR = path.join(ROOT, "generated", "source");
const CROPPED_DIR = path.join(ROOT, "generated", "cropped");
const EXPORT_DIR = path.join(ROOT, "..", "assets", "sprites");

// "rent_office_2026-05-29T11-41-58-314Z.png" -> "rent_office"
// also strips the "_crop_<stamp>" suffix on cropped files.
function friendlyName(basename: string): string {
  return (
    basename
      .replace(/\.png$/i, "")
      .replace(/_\d{4}-\d{2}-\d{2}T.*$/, "") || "asset"
  );
}

function diskPathFor(url: string): string | null {
  const base = path.basename(url);
  if (url.startsWith("/generated/source/")) return path.join(SOURCE_DIR, base);
  if (url.startsWith("/generated/cropped/")) return path.join(CROPPED_DIR, base);
  return null;
}

async function main() {
  const file = Bun.file(LAYOUT_FILE);
  if (!(await file.exists())) {
    console.error('No layout.json found. Save a layout in the tool first (Save Layout).');
    process.exit(1);
  }

  let layout: { cells?: unknown[] };
  try {
    layout = await file.json();
  } catch {
    console.error("layout.json is not valid JSON.");
    process.exit(1);
  }

  const cells = layout.cells;
  if (!Array.isArray(cells)) {
    console.error("layout.json has no cells array.");
    process.exit(1);
  }

  await mkdir(EXPORT_DIR, { recursive: true });

  const usedNames = new Map<string, string>(); // friendly name -> source url
  const seenSrc = new Set<string>();
  let copied = 0;
  let skipped = 0;

  for (const cell of cells) {
    const src = typeof cell === "string" ? cell : (cell as { src?: string })?.src;
    if (!src) continue;
    if (seenSrc.has(src)) continue; // same image placed in multiple cells
    seenSrc.add(src);

    const disk = diskPathFor(src);
    if (!disk || !(await Bun.file(disk).exists())) {
      console.warn(`  ! skipped (not found): ${src}`);
      skipped++;
      continue;
    }

    let name = friendlyName(path.basename(src));
    // Two different images that reduce to the same name get -2, -3, …
    if (usedNames.has(name) && usedNames.get(name) !== src) {
      let n = 2;
      while (usedNames.has(`${name}-${n}`)) n++;
      name = `${name}-${n}`;
    }
    usedNames.set(name, src);

    await copyFile(disk, path.join(EXPORT_DIR, `${name}.png`));
    console.log(`  ✓ ${path.basename(src)}  →  export/${name}.png`);
    copied++;
  }

  console.log(`\nDone: ${copied} exported${skipped ? `, ${skipped} skipped` : ""} → ${EXPORT_DIR}`);
}

main();
