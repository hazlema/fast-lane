import { runBatch, type BatchFile } from "./batch-core";

async function main() {
  const filePath = process.argv[2];

  if (!filePath) {
    console.error("Usage: bun batch.ts <path-to-batch.json>");
    process.exit(1);
  }

  const file = Bun.file(filePath);

  if (!(await file.exists())) {
    console.error(`Batch file not found: ${filePath}`);
    process.exit(1);
  }

  let batch: BatchFile;
  try {
    batch = await file.json();
  } catch (err) {
    console.error(`Could not parse JSON in ${filePath}: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }

  const total = batch.items?.length ?? 0;
  console.log(`Starting batch: ${total} item(s)\n`);

  let result;
  try {
    result = await runBatch(batch, (p) => {
      if (p.status === "start") {
        console.log(`[${p.index}/${p.total}] Generating "${p.name}"…`);
      } else if (p.status === "ok") {
        console.log(`  ✓ saved ${p.imagePath}\n`);
      } else {
        console.log(`  ✗ failed: ${p.error}\n`);
      }
    });
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  console.log(`Done: ${result.ok} succeeded, ${result.failures.length} failed`);

  if (result.failures.length > 0) {
    console.log("\nFailures:");
    for (const f of result.failures) {
      console.log(`  - "${f.name}": ${f.error}`);
    }
    process.exit(1);
  }
}

main();
