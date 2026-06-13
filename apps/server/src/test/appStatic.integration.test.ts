import assert from "node:assert/strict";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, describe, it } from "node:test";

type TestServer = {
  close: () => Promise<void>;
  url: string;
};

async function startServer(): Promise<TestServer> {
  const { createApp } = await import("../app.js");
  const app = createApp();
  const server = await new Promise<Server>((resolve) => {
    const listener = app.listen(0, "127.0.0.1", () => {
      resolve(listener);
    });
  });
  const address = server.address() as AddressInfo;

  return {
    close: () => new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    }),
    url: `http://127.0.0.1:${address.port}`
  };
}

describe("app static assets", () => {
  let testServer: TestServer;

  before(async () => {
    testServer = await startServer();
  });

  after(async () => {
    await testServer.close();
  });

  it("serves the SVG favicon referenced by the admin shell", async () => {
    const response = await fetch(`${testServer.url}/favicon.svg`);
    const body = await response.text();

    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") ?? "", /image\/svg\+xml/u);
    assert.match(body, /<svg/u);
  });
});
