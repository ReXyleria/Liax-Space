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

  it("accepts 12 MiB markdown version payloads before authentication", async () => {
    const server = await listen();

    try {
      const markdown = `# Large import\n\n${"A".repeat(12 * 1024 * 1024)}`;
      const response = await fetch(`${server.origin}/admin/articles/1/zh-CN/versions`, {
        body: JSON.stringify({
          baseVersionId: null,
          mdContent: markdown
        }),
        headers: {
          "Content-Type": "application/json"
        },
        method: "POST"
      });
      const body = await response.json();

      assert.equal(response.status, 401);
      assert.match(response.headers.get("content-type") ?? "", /application\/json/);
      assert.equal(body.error.code, "UNAUTHORIZED");
    } finally {
      await server.close();
    }
  });

  it("keeps the default JSON body limit for non-version APIs", async () => {
    const server = await listen();

    try {
      const response = await fetch(`${server.origin}/auth/login`, {
        body: JSON.stringify({
          email: "admin@example.test",
          password: "A".repeat(128 * 1024)
        }),
        headers: {
          "Content-Type": "application/json"
        },
        method: "POST"
      });
      const body = await response.json();

      assert.equal(response.status, 413);
      assert.match(response.headers.get("content-type") ?? "", /application\/json/);
      assert.equal(body.error.code, "VALIDATION_FAILED");
      assert.equal(body.error.message, "Request body is too large.");
    } finally {
      await server.close();
    }
  });
});
