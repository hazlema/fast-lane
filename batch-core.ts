import { generateAsset, type GenerateInput } from "./generate";

export interface BatchItem {
  assetName?: string;
  signText?: string;
  description?: string;
  model?: string;
  size?: string;
  quality?: string;
  kind?: string;
}

export interface BatchFile {
  defaults?: Partial<BatchItem>;
  items?: BatchItem[];
}

export const DEFAULTS = {
  model: "gpt-image-1.5",
  size: "1024x1024",
  quality: "high"
};

export function resolveItem(item: BatchItem, defaults: Partial<BatchItem>): GenerateInput {
  const assetName = item.assetName ?? defaults.assetName ?? "asset";
  return {
    assetName,
    signText: item.signText ?? defaults.signText ?? assetName,
    description: item.description ?? defaults.description ?? "",
    model: item.model ?? defaults.model ?? DEFAULTS.model,
    size: item.size ?? defaults.size ?? DEFAULTS.size,
    quality: item.quality ?? defaults.quality ?? DEFAULTS.quality,
    kind: item.kind ?? defaults.kind ?? "building"
  };
}

export interface BatchProgress {
  index: number; // 1-based
  total: number;
  name: string;
  status: "start" | "ok" | "error";
  imagePath?: string;
  imageUrl?: string;
  error?: string;
}

export interface BatchResult {
  ok: number;
  failures: { name: string; error: string }[];
}

/**
 * Runs a batch sequentially, reporting progress through `onProgress`.
 * Throws if the batch has no non-empty `items` array. Per-item errors are
 * caught, reported, and the run continues.
 */
export async function runBatch(
  batch: BatchFile,
  onProgress: (p: BatchProgress) => void
): Promise<BatchResult> {
  const items = batch.items;
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('Batch must contain a non-empty "items" array.');
  }

  const defaults = batch.defaults ?? {};
  const total = items.length;
  const failures: { name: string; error: string }[] = [];
  let ok = 0;

  for (let i = 0; i < total; i++) {
    const input = resolveItem(items[i], defaults);
    const index = i + 1;
    onProgress({ index, total, name: input.assetName, status: "start" });

    try {
      const result = await generateAsset(input);
      ok++;
      onProgress({
        index,
        total,
        name: input.assetName,
        status: "ok",
        imagePath: result.imagePath,
        imageUrl: result.imageUrl
      });
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      failures.push({ name: input.assetName, error });
      onProgress({ index, total, name: input.assetName, status: "error", error });
    }
  }

  return { ok, failures };
}
