import assert from "node:assert/strict";
import { createServer } from "node:http";
import { describe, it } from "node:test";

import { createApp } from "./app.js";

async function listen(app = createApp()): Promise<{ origin: string; close: () => Promise<void> }> {
  const server = createServer(app);

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.equal(typeof address, "object");
  assert.ok(address);

  return {
    origin: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    })
  };
}

describe("app routing", () => {
  it("redirects the bare root to the default public locale", async () => {
    const server = await listen();

    try {
      const response = await fetch(`${server.origin}/`, { redirect: "manual" });

      assert.equal(response.status, 302);
      assert.equal(response.headers.get("location"), "/zh");
    } finally {
      await server.close();
    }
  });

  it("returns JSON 404s for unmatched reserved API prefixes", async () => {
    const server = await listen();

    try {
      for (const path of ["/admin/me", "/setup/admin", "/auth/missing"]) {
        const response = await fetch(`${server.origin}${path}`, { redirect: "manual" });
        const body = await response.json();

        assert.equal(response.status, 404);
        assert.match(response.headers.get("content-type") ?? "", /application\/json/);
        assert.equal(body.error.code, "NOT_FOUND");
        assert.equal(body.error.message, "API route not found.");
      }
    } finally {
      await server.close();
    }
  });
});
