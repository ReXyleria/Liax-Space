import assert from "node:assert/strict";
import { createServer } from "node:http";
import { describe, it } from "node:test";

import { createApp } from "./app.js";

describe("app routing", () => {
  it("redirects the bare root to the default public locale", async () => {
    const server = createServer(createApp());

    try {
      await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
      const address = server.address();
      assert.equal(typeof address, "object");
      assert.ok(address);

      const response = await fetch(`http://127.0.0.1:${address.port}/`, { redirect: "manual" });

      assert.equal(response.status, 302);
      assert.equal(response.headers.get("location"), "/zh");
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
    }
  });
});
