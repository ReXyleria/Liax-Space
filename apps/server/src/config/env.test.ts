import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

describe("env defaults", () => {
  it("creates runtime secrets when JWT and pepper env variables are not provided", async () => {
    const runtimeDir = await mkdtemp(path.join(tmpdir(), "liax-env-runtime-"));
    const childEnv: NodeJS.ProcessEnv = {
      ...process.env,
      APP_ENV: "test",
      APP_HOST: "127.0.0.1",
      APP_PORT: "3199",
      DATABASE_HOST: "127.0.0.1",
      DATABASE_NAME: "liax_space",
      DATABASE_PASSWORD: "root",
      DATABASE_PORT: "3306",
      DATABASE_USER: "root",
      PUBLIC_BASE_URL: "http://127.0.0.1:3199",
      STORAGE_RENDERED_DIR: path.join(runtimeDir, "rendered"),
      STORAGE_RUNTIME_DIR: runtimeDir,
      STORAGE_UPLOADS_DIR: path.join(runtimeDir, "uploads")
    };

    delete childEnv.JWT_SECRET;
    delete childEnv.PASSWORD_PEPPER;

    const result = spawnSync(
      process.execPath,
      [
        "--import",
        "tsx",
        "-e",
        "import { env } from './src/config/env.ts'; console.log(JSON.stringify({ jwtLength: env.jwtSecret.length, pepperLength: env.passwordPepper.length, host: env.appHost, port: env.appPort }));"
      ],
      {
        cwd: serverRoot,
        encoding: "utf8",
        env: childEnv
      }
    );

    try {
      assert.equal(result.status, 0, result.stderr);
      const parsed = JSON.parse(result.stdout.trim()) as {
        host: string;
        jwtLength: number;
        pepperLength: number;
        port: number;
      };

      assert.equal(parsed.host, "127.0.0.1");
      assert.equal(parsed.port, 3199);
      assert.equal(parsed.jwtLength, 64);
      assert.equal(parsed.pepperLength, 64);
      assert.equal(existsSync(path.join(runtimeDir, "jwt-secret")), true);
      assert.equal(existsSync(path.join(runtimeDir, "password-pepper")), true);
      assert.equal((await readFile(path.join(runtimeDir, "jwt-secret"), "utf8")).trim().length, 64);
      assert.equal((await readFile(path.join(runtimeDir, "password-pepper"), "utf8")).trim().length, 64);
    } finally {
      await rm(runtimeDir, { force: true, recursive: true });
    }
  });
});
