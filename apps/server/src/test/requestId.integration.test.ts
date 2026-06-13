import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { AddressInfo } from "node:net";
import express from "express";
import type { Server } from "node:http";

import { requestIdMiddleware } from "../common/requestId.js";

type TestServer = {
  close: () => Promise<void>;
  url: string;
};

async function startServer(): Promise<TestServer> {
  const app = express();

  app.use(requestIdMiddleware);
  app.get("/request-id", (request, response) => {
    response.status(200).json({
      requestId: request.requestId
    });
  });

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

describe("requestId integration", () => {
  let testServer: TestServer;

  before(async () => {
    testServer = await startServer();
  });

  after(async () => {
    await testServer.close();
  });

  it("returns the request id in the response header and body", async () => {
    const response = await fetch(`${testServer.url}/request-id`, {
      headers: {
        "x-request-id": "integration-request-id"
      }
    });
    const body = await response.json() as { requestId: string };

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("x-request-id"), "integration-request-id");
    assert.equal(body.requestId, "integration-request-id");
  });
});
