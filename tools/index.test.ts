import { test, expect } from "bun:test";
import { handleToolsRequest } from "./index";

test("serves /api/board-data as JSON", async () => {
  const res = await handleToolsRequest(new Request("http://localhost/api/board-data"));
  expect(res).not.toBeNull();
  expect(res!.status).toBe(200);
  const data = await res!.json();
  expect(data.boardSize).toBeDefined();
  expect(Array.isArray(data.buildings)).toBe(true);
});

test("serves the /tools foundry when the OpenAI key is set", async () => {
  const prev = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "sk-test";
  try {
    const res = await handleToolsRequest(new Request("http://localhost/tools"));
    expect(res!.status).toBe(200);
    expect(res!.headers.get("content-type")).toContain("text/html");
    expect(await res!.text()).toContain("Layout Tool");
  } finally {
    if (prev === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = prev;
  }
});

test("/tools shows a friendly notice when the OpenAI key is missing", async () => {
  const prev = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  try {
    const res = await handleToolsRequest(new Request("http://localhost/tools"));
    expect(res!.status).toBe(200);
    expect(res!.headers.get("content-type")).toContain("text/html");
    expect(await res!.text()).toContain("API key not set");
  } finally {
    if (prev === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = prev;
  }
});

test("serves the /validate page as html", async () => {
  const res = await handleToolsRequest(new Request("http://localhost/validate"));
  expect(res!.status).toBe(200);
  expect(res!.headers.get("content-type")).toContain("text/html");
});

test("returns null for paths it does not own", async () => {
  const res = await handleToolsRequest(new Request("http://localhost/some/game/route"));
  expect(res).toBeNull();
});
