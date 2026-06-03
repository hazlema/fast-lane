import { test, expect } from "bun:test";
import { Readable } from "node:stream";
import type { IncomingMessage } from "node:http";
import { toWebRequest } from "./vite-tools-plugin";

test("builds a web Request from a GET node request", async () => {
  const fake = { url: "/tools", method: "GET", headers: { host: "localhost" } } as unknown as IncomingMessage;
  const request = await toWebRequest(fake);
  expect(request.method).toBe("GET");
  expect(new URL(request.url).pathname).toBe("/tools");
});

test("captures the body of a POST node request", async () => {
  const stream = Readable.from([Buffer.from("hello world")]) as unknown as IncomingMessage;
  stream.url = "/api/batch";
  stream.method = "POST";
  stream.headers = { host: "localhost", "content-type": "text/plain" };
  const request = await toWebRequest(stream);
  expect(request.method).toBe("POST");
  expect(await request.text()).toBe("hello world");
});
