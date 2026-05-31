# Batch Asset Generation — Design

**Date:** 2026-05-29
**Status:** Approved

## Goal

Run a JSON-defined list of asset generations from the command line, with live
progress feedback and an end-of-run summary. The existing one-at-a-time web UI
stays unchanged.

## Background

`index.ts` is a Bun server that serves a single HTML form and a
`POST /api/generate` endpoint. The endpoint builds a prompt, calls the OpenAI
image API, and saves a `.png` (to `generated/source/`) plus the prompt `.txt`
(to `generated/prompts/`). All generation logic currently lives inline in the
POST handler.

## Architecture

### 1. Extract shared generation logic into `generate.ts`

Pull the reusable core out of the server's POST handler:

- `openai` client + dir constants (`ROOT`, `SOURCE_DIR`, `PROMPT_DIR`), and the
  `mkdir` of those dirs.
- `slugify(value: string): string`
- `buildPrompt({ description, signText }): string`
- `generateAsset(input): Promise<GenerateResult>` — the new shared function.

```ts
interface GenerateInput {
  assetName: string;
  signText: string;
  description: string;
  model: string;
  size: string;
  quality: string;
}

interface GenerateResult {
  imagePath: string;
  promptPath: string;
  imageUrl: string;   // e.g. /generated/source/<base>.png
  prompt: string;
}
```

`generateAsset` computes `bg` (`"auto"` for `gpt-image-2`, else `"transparent"`),
builds the prompt, derives the timestamped base name, calls
`openai.images.generate(...)`, and writes both files. It **throws** on API errors
or when no image data is returned (no silent failure).

`index.ts` imports these and its POST handler becomes a thin wrapper: parse the
body, apply the same field defaults it uses today, call `generateAsset`, and
return JSON (or a 500 with the error message). No behavior change to the web UI.

### 2. New CLI: `batch.ts`

Run with `bun batch.ts <path-to-batch.json>`. Also added as an npm script
(`"batch": "bun batch.ts"`) so `bun run batch <file>` works.

**Input JSON** (defaults + items):

```json
{
  "defaults": { "model": "gpt-image-1.5", "size": "1024x1024", "quality": "high" },
  "items": [
    {
      "assetName": "Low Cost Housing",
      "signText": "Low Cost Housing",
      "description": "a neglected low-cost apartment building..."
    }
  ]
}
```

Field resolution per item (highest priority first):

1. Field on the item
2. Field in top-level `defaults`
3. Built-in fallback (matching the server: `model` `gpt-image-1.5`,
   `size` `1024x1024`, `quality` `high`; `signText` falls back to `assetName`;
   `assetName` falls back to `"asset"`).

`defaults` is optional. `assetName` and `description` are expected per item.

**Flow:**

1. Read the file path from `process.argv[2]`. If missing, print usage and exit
   non-zero.
2. Read + parse JSON. If the file is missing or malformed, print a clear error
   and exit non-zero.
3. Validate `items` is a non-empty array; otherwise error and exit non-zero.
4. Loop items **sequentially** (avoids rate-limit hammering). For each item at
   index `i` of `n`:
   - Print `[i/n] Generating "<assetName>"…`
   - Resolve fields, call `generateAsset`.
   - On success: print `  ✓ saved <imagePath>`.
   - On failure: catch, print `  ✗ failed: <message>`, record `{ name, error }`,
     and **continue**.
5. After the loop, print a summary: `Done: <ok> succeeded, <failed> failed`.
   If any failed, list each failed item's name + error message.
6. Exit code: `0` if all succeeded, `1` if any failed.

## Error handling

- Malformed/missing batch file or empty `items`: fail fast before any API call.
- Per-item generation errors: caught, reported, batch continues (chosen
  behavior — no retries).

## Testing

- Manual: run `batch.ts` against a small batch JSON (1–2 items) and confirm
  files land in `generated/source/` and `generated/prompts/`, progress prints,
  and the summary is correct.
- Failure path: include an item with an invalid model to confirm the batch
  reports the failure and continues / exits non-zero.
- Regression: the web UI (`bun index.ts`) still generates a single asset
  correctly after the refactor.

## Out of scope (YAGNI)

- Retries on failure
- Multiple variations per item (`count`)
- Parallel / concurrent generation
- Any web UI changes
- Progress persistence / resume

## Notes

- This project is not currently a git repository, so the design doc is saved but
  not committed.
- Pre-existing issue (not addressed here): the OpenAI API key is hardcoded in
  `index.ts`; it should be rotated and moved to an env var.
