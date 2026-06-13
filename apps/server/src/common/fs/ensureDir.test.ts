import assert from "node:assert/strict";
import { mkdtemp, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import { ensureDir } from "./ensureDir.js";

describe("ensureDir", () => {
  it("creates nested directories", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "liax-ensure-dir-"));
    const nestedDir = join(rootDir, "a", "b", "c");

    await ensureDir(nestedDir);

    assert.equal((await stat(nestedDir)).isDirectory(), true);
  });
});
